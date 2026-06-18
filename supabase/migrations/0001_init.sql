-- ============================================================================
-- Short Kings — Phase 1: Auth + Real Referrals
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- Idempotency: written to be safe to re-run during development.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

-- 1:1 with auth.users
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique,
  referral_code text unique not null,
  referred_by   uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  -- Phase 1 anti-abuse signals (Section 6) — nullable, captured at signup,
  -- used later to spot self-referral rings. Never trusted for gating in Phase 1.
  signup_ip          inet,
  signup_fingerprint text
);

-- referral ledger (one row per successful referral)
create table if not exists public.referrals (
  id           uuid primary key default gen_random_uuid(),
  referrer_id  uuid not null references public.profiles(id) on delete cascade,
  referred_id  uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (referred_id),               -- a user can be referred only once
  check (referrer_id <> referred_id)  -- no self-referral
);

create index if not exists referrals_referrer_id_idx on public.referrals (referrer_id);

-- ----------------------------------------------------------------------------
-- Server-side unique code generation
-- ----------------------------------------------------------------------------
create or replace function public.gen_referral_code()
returns text language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- no ambiguous chars
  code text;
  i int;
begin
  loop
    code := 'SK';
    for i in 1..6 loop
      code := code || substr(alphabet, floor(random()*length(alphabet))::int + 1, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where referral_code = code);
  end loop;
  return code;
end $$;

-- ----------------------------------------------------------------------------
-- Auto-create a profile (with code) on every signup
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, referral_code)
  values (new.id, public.gen_referral_code());
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Attribution RPC (the ?ref= -> real referral handoff).
-- Called by the authenticated client right after signup, passing the
-- captured code. security definer so it can write past RLS with its own guards.
-- ----------------------------------------------------------------------------
create or replace function public.attribute_referral(p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_referrer uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;

  -- already attributed? do nothing (idempotent)
  if exists (select 1 from public.referrals where referred_id = v_user) then return; end if;

  select id into v_referrer from public.profiles where referral_code = upper(trim(p_code));
  if v_referrer is null then return; end if;   -- invalid code -> ignore silently
  if v_referrer = v_user then return; end if;  -- self-referral -> ignore

  insert into public.referrals (referrer_id, referred_id) values (v_referrer, v_user);
  update public.profiles set referred_by = v_referrer
    where id = v_user and referred_by is null;
end $$;

-- ----------------------------------------------------------------------------
-- Referral stats RPC (for the dashboard)
-- ----------------------------------------------------------------------------
create or replace function public.my_referral_count()
returns int language sql security definer set search_path = public as $$
  select count(*)::int from public.referrals where referrer_id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- Inserts into profiles/referrals happen only through the security-definer
-- functions above (trigger + RPC), which bypass RLS safely. Clients never
-- insert directly, so no insert policies are needed.
-- ----------------------------------------------------------------------------
alter table public.profiles  enable row level security;
alter table public.referrals enable row level security;

drop policy if exists "read own profile"   on public.profiles;
drop policy if exists "update own profile"  on public.profiles;
drop policy if exists "referrer reads own"  on public.referrals;

create policy "read own profile"   on public.profiles  for select using (auth.uid() = id);
create policy "update own profile" on public.profiles  for update using (auth.uid() = id);
create policy "referrer reads own" on public.referrals for select using (auth.uid() = referrer_id);
