-- ============================================================================
-- Short Kings — Phase 2: Tasks + XP
-- Wallet sign-in (Supabase Web3 / Sign-in-with-Solana) is the primary login.
-- Run after 0001_init.sql. Safe to re-run.
--
-- PREREQUISITE (one-time, in the Supabase dashboard):
--   Authentication → Sign In / Providers → enable **Web3 Wallet (Solana)**.
--   Without it, supabase.auth.signInWithWeb3({chain:'solana'}) returns an error.
-- ============================================================================

-- Wallet address on the profile. Wallet sign-in creates an auth.users row, the
-- existing handle_new_user() trigger makes the profile + referral code, then the
-- client calls set_wallet_address() to stamp the address here.
alter table public.profiles add column if not exists wallet_address text unique;

-- ----------------------------------------------------------------------------
-- Task catalog (public, read-only to clients)
-- ----------------------------------------------------------------------------
create table if not exists public.tasks (
  key              text primary key,
  title            text not null,
  description      text not null,
  xp               int  not null check (xp >= 0),
  frequency        text not null default 'once'
                     check (frequency in ('once','daily','cooldown')),
  cooldown_seconds int,
  action_type      text not null default 'click'
                     check (action_type in ('click','tweet','external')),
  action_url       text,
  sort_order       int  not null default 0,
  active           boolean not null default true
);

-- ----------------------------------------------------------------------------
-- Completion ledger — the single source of truth for XP.
-- period_key dedups completions per frequency window:
--   once     -> 'once'              (one ever)
--   daily    -> 'YYYY-MM-DD' (UTC)  (one per day)
--   cooldown -> epoch string        (always unique; cadence enforced in RPC)
-- ----------------------------------------------------------------------------
create table if not exists public.task_completions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  task_key    text not null references public.tasks(key),
  xp_awarded  int  not null,
  period_key  text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, task_key, period_key)
);
create index if not exists task_completions_user_idx on public.task_completions (user_id);

-- ----------------------------------------------------------------------------
-- Seed the starter quests (idempotent)
--
-- VERIFICATION NOTE: complete_task enforces XP amount, task validity, and the
-- daily/cooldown windows server-side, but it does NOT verify off-platform
-- actions. 'tweet'/'external' tasks (tweet, follow, join_tg, share_referral)
-- are HONOR-BASED — a determined user can claim them without performing the
-- action. Truly gating those needs X/Telegram API callbacks writing the
-- completion from a service-role server route. Only daily_checkin is fully
-- enforced (pure time-gate). Keep reward sizes in mind accordingly.
-- ----------------------------------------------------------------------------
insert into public.tasks (key, title, description, xp, frequency, cooldown_seconds, action_type, action_url, sort_order) values
  ('daily_checkin',  'Daily Check-In',     'Tap in every day to claim your crown XP.',                50,  'daily',    null,  'click',    null, 1),
  ('tweet_short',    'Tweet about $SHORT',  'Post about $SHORT on X. Earn once per day.',              100, 'daily',    null,  'tweet',    'https://twitter.com/intent/tweet?text=Long%20live%20the%20Short%20Kings.%20%F0%9F%91%91%20%24SHORT%20is%20God%27s%20favorite%20height.&url=https%3A%2F%2Fwww.shortkings.site', 2),
  ('follow_x',       'Follow on X',         'Follow @shortkingsbags on X.',                            75,  'once',     null,  'external', 'https://x.com/shortkingsbags', 3),
  ('join_tg',        'Join the Telegram',   'Join the Short Kings Telegram.',                          75,  'once',     null,  'external', 'https://t.me/ShortKingsBags', 4),
  ('share_referral', 'Share your link',     'Spread your royal referral link. Earn every 6 hours.',    60,  'cooldown', 21600, 'external', null, 5)
on conflict (key) do update set
  title            = excluded.title,
  description      = excluded.description,
  xp               = excluded.xp,
  frequency        = excluded.frequency,
  cooldown_seconds = excluded.cooldown_seconds,
  action_type      = excluded.action_type,
  action_url       = excluded.action_url,
  sort_order       = excluded.sort_order,
  active           = excluded.active;

-- ----------------------------------------------------------------------------
-- Stamp the wallet address on the caller's profile (once).
-- ----------------------------------------------------------------------------
create or replace function public.set_wallet_address(p_addr text)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  -- Basic shape guard (base58, Solana pubkey length); ignore junk.
  if p_addr is null or p_addr !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then return; end if;
  update public.profiles set wallet_address = p_addr
    where id = v_user and wallet_address is null;
exception
  -- Address already claimed by another profile: do not 500 the caller. The
  -- SIWS session is the real identity; wallet_address is just a convenience
  -- mapping, so leaving it unset here is harmless.
  when unique_violation then return;
end $$;

-- ----------------------------------------------------------------------------
-- Total XP for the caller (sum of the ledger).
-- ----------------------------------------------------------------------------
create or replace function public.my_xp()
returns int language sql security definer set search_path = public as $$
  select coalesce(sum(xp_awarded), 0)::int
  from public.task_completions where user_id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- Complete a task. ALL award logic is server-side; the client cannot set XP or
-- bypass frequency/cooldown. Returns a status JSON (never trusts client input
-- beyond the task key).
-- ----------------------------------------------------------------------------
create or replace function public.complete_task(p_task_key text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_user   uuid := auth.uid();
  v_task   public.tasks%rowtype;
  v_period text;
  v_last   timestamptz;
  v_rows   int;
  v_total  int;
begin
  if v_user is null then raise exception 'not authenticated'; end if;

  -- Serialize concurrent completions for this (user, task). For cooldown tasks
  -- the unique index is NOT a backstop (period_key is per-call unique), so
  -- without this lock parallel calls could both pass the read-then-check window
  -- and double-award. The xact lock releases at commit.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || p_task_key, 0));

  select * into v_task from public.tasks where key = p_task_key and active = true;
  if not found then raise exception 'unknown_task'; end if;

  if v_task.frequency = 'once' then
    v_period := 'once';
  elsif v_task.frequency = 'daily' then
    v_period := to_char(timezone('utc', now())::date, 'YYYY-MM-DD');
  else
    -- cooldown: reject if the last completion is still inside the window
    select max(created_at) into v_last from public.task_completions
      where user_id = v_user and task_key = p_task_key;
    if v_last is not null
       and v_last > now() - make_interval(secs => coalesce(v_task.cooldown_seconds, 0)) then
      return json_build_object(
        'status', 'cooldown', 'awarded', 0, 'total_xp', public.my_xp(),
        'next_at', v_last + make_interval(secs => coalesce(v_task.cooldown_seconds, 0)));
    end if;
    v_period := extract(epoch from clock_timestamp())::bigint::text;
  end if;

  insert into public.task_completions (user_id, task_key, xp_awarded, period_key)
  values (v_user, p_task_key, v_task.xp, v_period)
  on conflict (user_id, task_key, period_key) do nothing;
  get diagnostics v_rows = row_count;

  v_total := public.my_xp();
  if v_rows > 0 then
    return json_build_object('status', 'ok', 'awarded', v_task.xp, 'total_xp', v_total);
  else
    return json_build_object('status', 'already', 'awarded', 0, 'total_xp', v_total);
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- All active tasks + the caller's per-task state, for rendering the board.
-- ----------------------------------------------------------------------------
create or replace function public.my_tasks()
returns json language sql security definer set search_path = public as $$
  select coalesce(json_agg(t order by t.sort_order), '[]'::json)
  from (
    select
      k.key, k.title, k.description, k.xp, k.frequency, k.cooldown_seconds,
      k.action_type, k.action_url, k.sort_order,
      case
        when k.frequency = 'once' then exists (
          select 1 from public.task_completions c
          where c.user_id = auth.uid() and c.task_key = k.key)
        when k.frequency = 'daily' then exists (
          select 1 from public.task_completions c
          where c.user_id = auth.uid() and c.task_key = k.key
            and c.period_key = to_char(timezone('utc', now())::date, 'YYYY-MM-DD'))
        else false
      end as done,
      (select max(c.created_at) from public.task_completions c
        where c.user_id = auth.uid() and c.task_key = k.key) as last_completed_at
    from public.tasks k
    where k.active = true
  ) t;
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security. Inserts happen only via complete_task (security definer),
-- so no insert policy is exposed to clients.
-- ----------------------------------------------------------------------------
alter table public.tasks            enable row level security;
alter table public.task_completions enable row level security;

drop policy if exists "tasks readable"  on public.tasks;
drop policy if exists "own completions" on public.task_completions;

create policy "tasks readable"  on public.tasks            for select using (true);
create policy "own completions" on public.task_completions for select using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Make identity/anti-abuse columns on profiles write-once. The "update own
-- profile" policy (0001) lets a client UPDATE its own row; without this a user
-- could overwrite their wallet_address / referred_by / signup_ip etc. This
-- trigger silently keeps the old value for protected columns (set-once: null ->
-- value is allowed, value -> different is ignored). Definer functions fire it
-- too, but they only ever set null -> value, so they're unaffected.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_profile_immutables()
returns trigger language plpgsql as $$
begin
  new.referral_code := old.referral_code;  -- never changes after creation
  if old.referred_by        is not null then new.referred_by        := old.referred_by;        end if;
  if old.wallet_address     is not null then new.wallet_address     := old.wallet_address;     end if;
  if old.signup_ip          is not null then new.signup_ip          := old.signup_ip;          end if;
  if old.signup_fingerprint is not null then new.signup_fingerprint := old.signup_fingerprint; end if;
  return new;
end $$;

drop trigger if exists profiles_immutable on public.profiles;
create trigger profiles_immutable before update on public.profiles
for each row execute function public.enforce_profile_immutables();

-- ----------------------------------------------------------------------------
-- Least-privilege on the RPCs: by default Postgres grants EXECUTE to PUBLIC.
-- These all require an authenticated session (auth.uid()), so revoke from anon
-- and grant only to authenticated. (Also covers the 0001 RPCs.)
-- ----------------------------------------------------------------------------
revoke execute on function
  public.complete_task(text), public.set_wallet_address(text),
  public.my_xp(), public.my_tasks(),
  public.attribute_referral(text), public.my_referral_count()
  from public, anon;
grant execute on function
  public.complete_task(text), public.set_wallet_address(text),
  public.my_xp(), public.my_tasks(),
  public.attribute_referral(text), public.my_referral_count()
  to authenticated;

