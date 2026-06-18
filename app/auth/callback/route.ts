import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth callback for magic-link / OAuth (PKCE).
 *
 * After exchanging the code for a session, this is the reliable "first
 * authenticated moment" — so we do the ?ref= -> real referral handoff here:
 *   1. read the sk_ref cookie captured by middleware
 *   2. call attribute_referral() (server enforces invalid/self/double guards)
 *   3. clear the cookie so it can't re-fire
 *   4. best-effort: stamp signup_ip on the new profile (anti-abuse signal)
 *
 * attribute_referral is idempotent and only-once, so running it on every login
 * (not just signup) is harmless.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const cookieStore = await cookies();
  const ref = cookieStore.get("sk_ref")?.value;
  if (ref) {
    // Invalid code / self-referral / already-attributed are all handled inside
    // the RPC; we swallow errors so a bad code never blocks sign-in.
    try {
      await supabase.rpc("attribute_referral", { p_code: ref });
    } catch {
      // ignore — attribution is best-effort at this step
    }
    cookieStore.set("sk_ref", "", { maxAge: 0, path: "/" });
  }

  // Best-effort signup IP capture (only sets when still null; RLS lets a user
  // update their own row). Never trusted for gating — just a forensics signal.
  try {
    const hdrs = await headers();
    const ip =
      hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      hdrs.get("x-real-ip") ||
      null;
    if (ip) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ signup_ip: ip })
          .eq("id", user.id)
          .is("signup_ip", null);
      }
    }
  } catch {
    // non-fatal
  }

  return NextResponse.redirect(`${origin}${next}`);
}
