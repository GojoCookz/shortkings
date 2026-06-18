# Short Kings ($SHORT) — Web App

Next.js (App Router, TypeScript) + Supabase. The marketing landing page plus a
**real** referral system: accounts, server-generated referral codes, and a
referral ledger backed by Postgres.

This is **Phase 1** of the backend spec (`shortkings-backend-spec.md`): Auth +
Real Referrals. XP/streaks, Stripe rev-share, and the token layer are later
phases — not built yet.

## Stack

- **Next.js 15** (App Router) — marketing page + app routes, deployed on Vercel
- **Supabase** — Postgres + Auth (email magic-link) + Row Level Security
- `@supabase/ssr` for cookie-based session handling across server/client

## Local setup

1. **Install deps**
   ```bash
   npm install
   ```

2. **Create a Supabase project** (supabase.com) and grab its API values from
   **Project Settings → API**.

3. **Configure env.** Copy the example and fill it in:
   ```bash
   cp .env.local.example .env.local
   ```
   | Var | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon/public key |
   | `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally |
   | `NEXT_PUBLIC_SOLANA_RPC` | Solana RPC for wallet balances; blank = public mainnet-beta |
   | `SUPABASE_SERVICE_ROLE_KEY` | leave blank for Phase 1 |

   `.env.local` is gitignored. Never commit real keys — especially the service role key.

4. **Run the migrations.** In the Supabase dashboard → **SQL Editor**, paste and
   run each in order:
   - [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) —
     `profiles` + `referrals`, code generator, signup trigger, `attribute_referral`
     / `my_referral_count` RPCs, RLS.
   - [`supabase/migrations/0002_xp_tasks.sql`](supabase/migrations/0002_xp_tasks.sql) —
     `tasks` + `task_completions`, `complete_task` / `my_tasks` / `my_xp` /
     `set_wallet_address` RPCs, RLS, and the `profiles.wallet_address` column.

5. **Configure Auth.** In Supabase → **Authentication**:
   - **URL Configuration → Redirect URLs**: add `http://localhost:3000/**` (and
     your Vercel domain) so email magic links return to `/auth/callback`.
   - **Sign In / Providers → enable "Web3 Wallet (Solana)"** — **required** for
     wallet sign-in (`signInWithWeb3`). Without it, wallet login returns an error.

6. **Run it**
   ```bash
   npm run dev   # http://localhost:3000
   ```

## Useful commands

| Command | What |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | Next/ESLint |

## How referral attribution works (the part that's now real)

1. A visitor lands on `/?ref=SKXXXXXX`. **Middleware** (`middleware.ts` →
   `lib/supabase/middleware.ts`) validates the code and stores it in a
   first-party `sk_ref` cookie (30 days).
2. They sign up at `/signup` (email magic-link). Supabase's `on_auth_user_created`
   trigger auto-creates a `profiles` row with a unique server-generated code.
3. On return to `/auth/callback`, after the session is established, the route
   reads `sk_ref` and calls `attribute_referral(p_code)`. The RPC enforces
   **invalid-code**, **self-referral**, and **double-attribution** guards
   server-side, writes a `referrals` row, then the cookie is cleared.
4. `/dashboard` shows the user's **real** code, share link, and live recruit
   count (`my_referral_count`) — backed by the DB, not random client noise.

## Wallet connect ($SHORT balance)

The top-right nav button is a Solana wallet connector ([components/WalletButton.tsx](components/WalletButton.tsx)):

- Disconnected → **Connect** (opens the wallet-adapter modal; auto-detects
  Phantom, Solflare, Backpack, Coinbase, etc. via the Wallet Standard).
- Connected → reads the wallet's balance of the $SHORT mint
  (`A8cMYsw7…BAGS`) via `getParsedTokenAccountsByOwner` and shows it on the
  button, e.g. **`8.4M SHORT`**. Clicking opens a dropdown to copy the address
  or disconnect.

Wallet context is provided app-wide by [components/SolanaProvider.tsx](components/SolanaProvider.tsx).
Balance reads use `NEXT_PUBLIC_SOLANA_RPC` — leave it blank for the public
endpoint while testing, but set a Helius/QuickNode URL for production (the
public RPC rate-limits and sometimes blocks browser balance reads).

## Wallet sign-in & Tasks/XP (Phase 2)

**Wallet is the primary login.** The nav button flows Connect → **Sign In** →
balance. "Sign In" calls `supabase.auth.signInWithWeb3({ chain: 'solana', wallet })`
([lib/supabase/walletSignIn.ts](lib/supabase/walletSignIn.ts)) — the wallet signs
a Sign-In-With-Solana message (free, no transaction), Supabase verifies it and
mints a session, and the existing `handle_new_user` trigger auto-creates the
profile + referral code. The wallet address is then stamped onto the profile via
`set_wallet_address`. Email magic-link login still works as a secondary path; a
session from either is the same account type.

**Tasks/XP** ([components/TasksSection.tsx](components/TasksSection.tsx), section
`#tasks` next to Perks): signed-in users complete tasks (daily check-in, tweet,
follow, join TG, share referral) to earn **$SHORT XP**. All award logic is
server-side in the `complete_task` RPC — the client cannot set XP, claim inactive
tasks, or bypass the daily/cooldown windows (enforced by `period_key` +
`unique(user_id, task_key, period_key)`). XP and rank show in the section header
and on `/dashboard`.

> **Honor-based caveat:** tweet/follow/join completions can't be verified without
> the X / Telegram APIs, so they're honor-based with frequency limits. Daily
> check-in is fully time-gated. Sybil farming (one person, many wallets) is the
> usual memecoin reality — gate high-value tasks behind `$SHORT` holdings or add a
> captcha when it matters. None of this affects the integrity of the XP *ledger*.

## End-to-end test

1. Sign up as **User A** (incognito window 1) at `/signup`. Open `/dashboard`,
   copy A's referral link (`/?ref=SK…`).
2. In a **fresh** incognito window 2, open A's link, then sign up as **User B**
   (different email).
3. Check results:
   - A new row exists in `public.referrals` (`referrer_id` = A, `referred_id` = B).
   - A's `/dashboard` "Kings Recruited" count is now **1**.
   - B's `profiles.referred_by` = A.
4. Negative cases (should all be silently rejected, no error to the user):
   - **Self-referral:** open your own `?ref=` link, sign up with that same
     account email → no `referrals` row.
   - **Double-signup / re-attribution:** sign in again as B with a different
     `?ref=` → still only one referral row for B (`unique(referred_id)`).
   - **Invalid code:** `/?ref=SKZZZZZZ` (nonexistent) → ignored.

## Project layout

```
app/
  page.tsx              Marketing landing (server component; auth-aware Recruit card)
  marketing.css         All landing styles (migrated from the old index.html)
  auth.css              Login / signup / dashboard styles
  login/  signup/       Magic-link auth (AuthForm)
  auth/callback/        Code exchange + referral attribution + signup-IP capture
  auth/signout/         POST sign-out
  dashboard/            Real code + share link + live referral count (protected)
components/             AuthForm, DashboardClient, LandingEffects, BeehiivForm
lib/supabase/           client.ts (browser), server.ts (RSC/route), middleware.ts (session)
middleware.ts           Session refresh, ?ref capture, /dashboard guard, IP rate-limit
supabase/migrations/    0001_init.sql — run this in Supabase
public/                 Images (copied from the original files/ dir)
files/                  Original static index.html kept for reference (not served)
```

## Known limitations (Phase 1)

- **Rate limiting is best-effort.** The in-memory IP limiter in `middleware.ts`
  is per-instance and resets on cold start — it only blunts crude single-source
  farming. Back it with Upstash Redis / Vercel KV for real abuse resistance. The
  hard guarantees live in the DB constraints (`unique(referred_id)`, self-ref check).
- **`signup_fingerprint`** column exists but is not yet populated (IP is captured
  at callback; device fingerprinting is a later anti-abuse add).
- The `update own profile` RLS policy (as specified) lets a user update their own
  row broadly. The referral *ledger* is the source of truth and is insert-only via
  the RPC, so recruit counts can't be spoofed this way — but consider a column
  guard before Phase 3 (real money).
