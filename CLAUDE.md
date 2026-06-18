# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The web app for **$SHORT** ("Short Kings Hotline"), a community memecoin on Solana traded via [bags.fm](https://bags.fm). It is a **Next.js 15 (App Router, TypeScript) + Supabase** app deployed on Vercel. The marketing landing page lives alongside a real referral system (accounts, server-generated codes, a referral ledger). This is **Phase 1** of [shortkings-backend-spec.md] — Auth + Real Referrals; XP/streaks, Stripe rev-share, and the token layer are explicitly later phases and are **not** built.

The original static site is preserved at [files/index.html](files/index.html) for reference only — it is **not** served. The live landing is [app/page.tsx](app/page.tsx).

## Commands

```bash
npm run dev        # dev server at http://localhost:3000
npm run build      # production build (catches App Router / RSC issues)
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
```

There is no test runner yet — the end-to-end referral test is a manual procedure documented in [README.md](README.md) ("End-to-end test"). Run it after any change to the attribution flow.

## Required setup before the app runs

The app needs Supabase env vars in `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`) and the migration applied. Without them, auth/dashboard error; the landing degrades gracefully to logged-out. See [README.md](README.md) for the full checklist. **The DB schema is not auto-applied** — [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql) must be run manually in the Supabase SQL editor.

## Architecture: how a referral becomes real

This is the core flow and it spans several files — understand it before touching any of them:

1. **Capture** — [middleware.ts](middleware.ts) (via [lib/supabase/middleware.ts](lib/supabase/middleware.ts)) runs on navigation: it refreshes the Supabase session, and if the URL has a valid `?ref=SK…` it writes a first-party `sk_ref` cookie (more reliable across the signup nav than localStorage).
2. **Account + code** — signup is email magic-link ([components/AuthForm.tsx](components/AuthForm.tsx)). The DB trigger `on_auth_user_created` → `handle_new_user()` auto-inserts a `profiles` row with a unique server-generated `referral_code`. Clients never generate codes anymore.
3. **Attribute** — [app/auth/callback/route.ts](app/auth/callback/route.ts) is the first authenticated moment. After `exchangeCodeForSession`, it reads `sk_ref` and calls the `attribute_referral(p_code)` RPC, then clears the cookie. **All guard logic (invalid code, self-referral, double-attribution) lives in the RPC**, not the client — it's `security definer` and idempotent, so calling it on every login is safe.
4. **Display** — [app/dashboard/page.tsx](app/dashboard/page.tsx) reads the real `referral_code` and `my_referral_count()` RPC. The dashboard is `force-dynamic` and guarded both by middleware and an in-component check.

### Database invariants (in [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql))

- The **`referrals` ledger is the source of truth** for recruit counts, and is **insert-only via the security-definer RPC** — clients have no insert policy. `unique(referred_id)` (one referrer per user) and `check(referrer_id <> referred_id)` (no self-referral) are enforced in SQL, not app code. Don't move these guarantees into TypeScript.
- RLS: users can only read/update their own `profiles` row and read referrals where they are the referrer. Writes happen through `security definer` functions that bypass RLS with their own checks.
- `profiles.signup_ip` / `signup_fingerprint` are nullable anti-abuse signals (IP stamped at callback); never used for gating in Phase 1.

## Supabase client conventions

Three entry points in [lib/supabase/](lib/supabase/) — use the right one:
- `client.ts` → `createClient()` for Client Components (`"use client"`).
- `server.ts` → `await createClient()` for Server Components / Route Handlers / Server Actions. **It's async** (Next 15 `cookies()` is async). Writing cookies from a Server Component is swallowed (middleware refreshes); cookie writes only land in route handlers/actions.
- `middleware.ts` → `updateSession()`, called from the root `middleware.ts`. Per `@supabase/ssr` rules: don't insert logic between `createServerClient` and `getUser()`, and always return the `supabaseResponse` (or copy its cookies) so refreshed auth cookies survive.

## Wallet connect (Solana)

The top-right nav "Connect" button ([components/WalletButton.tsx](components/WalletButton.tsx)) uses the **Solana Wallet Adapter** — note $SHORT is a **Solana** token, so this is *not* RainbowKit/EVM. Wallet context is app-wide via [components/SolanaProvider.tsx](components/SolanaProvider.tsx) (wrapped around `{children}` in the layout); wallets are auto-detected through the Wallet Standard (empty `wallets={[]}` array — don't hardcode adapters). Connected, the button reads the wallet's balance of the $SHORT mint and shows it formatted (`8.4M SHORT`). RPC endpoint is `NEXT_PUBLIC_SOLANA_RPC` (blank → public mainnet-beta, rate-limited — use Helius/QuickNode in prod). The mint address is duplicated in `WalletButton.tsx` as a `PublicKey` and as the bags.fm contract string in `page.tsx` — keep them in sync.

## Styling

Plain CSS, no framework. The theme (CSS variables, all landing components) is in [app/marketing.css](app/marketing.css) — migrated verbatim from the original `index.html` `<style>` blocks, including the formerly-inline dex-embed / earnings-panel / join-grid styles. Auth + dashboard styling is in [app/auth.css](app/auth.css). Change colors/fonts via the `:root` vars, not inline.

## Externally-coupled values (keep in sync when editing)

- **Bags.fm contract / buy link** `A8cMYsw7YaGmB1htaeF9bww4nGjN1czti5RNh2viBAGS` — repeated in the nav CTA, hero, charity footer, and How-to-Buy button in [app/page.tsx](app/page.tsx).
- **Dexscreener chart** uses a *different* Solana pair address (`FZEnmFGM…BvHD`) in the Chart iframe.
- **Charity royalty split** in the Charity Tracker is hand-maintained: each row's percentage and dollar amount plus the `$191.44` total must be edited together (the `CHARITY` array in [app/page.tsx](app/page.tsx)).
- Third-party embeds: beehiiv subscribe form id + `attribution.js`; X/Telegram socials.

## Scope discipline

Do **not** build XP, streaks, Stripe subscriptions/rev-share, or any token/cash-redemption mechanic without an explicit go-ahead — the spec gates the token layer behind legal review (securities / money-transmission / sweepstakes risk). Stay within Phase 1 unless asked.
