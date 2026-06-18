import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

const REF_RE = /^SK[A-Z0-9]{4,12}$/;
const REF_COOKIE = "sk_ref";
const REF_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Refreshes the Supabase auth session (required for SSR), captures an incoming
 * `?ref=` code into a first-party cookie, and guards protected routes.
 *
 * IMPORTANT (per @supabase/ssr docs): always return the `supabaseResponse`
 * object as-is, or copy its cookies onto any response you create instead, so the
 * refreshed auth cookies are not dropped.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do NOT run code between createServerClient and getUser() — it must run first.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // --- Capture incoming ?ref= into a first-party cookie (survives the nav into
  // signup more reliably than localStorage; readable server-side at callback). ---
  const incomingRef = request.nextUrl.searchParams.get("ref");
  if (
    incomingRef &&
    REF_RE.test(incomingRef.toUpperCase()) &&
    !request.cookies.get(REF_COOKIE)
  ) {
    supabaseResponse.cookies.set(REF_COOKIE, incomingRef.toUpperCase(), {
      maxAge: REF_MAX_AGE,
      httpOnly: false, // readable client-side for the "you were invited" badge
      sameSite: "lax",
      path: "/",
    });
  }

  // --- Protect the dashboard ---
  if (request.nextUrl.pathname.startsWith("/dashboard") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", "/dashboard");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
