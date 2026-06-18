import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Best-effort, in-memory IP rate limiter for account-creation hotspots
 * (the signup page and the auth callback that mints a session).
 *
 * CAVEAT: module-scope state on Vercel is per-instance and not shared across
 * regions/cold starts, so this only blunts crude single-source farming. For real
 * abuse resistance, back this with a durable store (Upstash Redis / Vercel KV).
 * The hard guarantees live in the DB (unique(referred_id), self-referral check).
 */
const WINDOW_MS = 60_000;
const MAX_HITS = 10; // per IP per window on guarded paths
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_HITS;
}

const GUARDED = ["/signup", "/auth/callback"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (GUARDED.some((p) => path.startsWith(p))) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    if (rateLimited(ip)) {
      return new NextResponse("Slow down, King. Too many attempts — try again in a minute.", {
        status: 429,
      });
    }
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and image files so the
     * session refresh + ?ref capture run on real navigations.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
