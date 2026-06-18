import "../auth.css";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import DashboardClient from "@/components/DashboardClient";

export const metadata = { title: "Your Dashboard — $SHORT" };

// Always render fresh — referral count and profile are per-user, per-request.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already guards this route, but double-check for safety.
  if (!user) redirect("/login?redirect=/dashboard");

  const { data: profile } = await supabase
    .from("profiles")
    .select("referral_code")
    .eq("id", user.id)
    .single();

  const { data: count } = await supabase.rpc("my_referral_count");

  return (
    <div className="dash-wrap">
      <div className="dash-head">
        <div>
          <h1>Your Court 👑</h1>
          <div className="dash-email">{user.email}</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link className="dash-signout" href="/" style={{ textDecoration: "none" }}>
            ← Home
          </Link>
          <form action="/auth/signout" method="post">
            <button className="dash-signout" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>

      {profile?.referral_code ? (
        <DashboardClient
          referralCode={profile.referral_code}
          count={count ?? 0}
          siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? ""}
        />
      ) : (
        <div className="dash-card">
          <div className="dc-label">Setting up your code…</div>
          <p style={{ color: "var(--text-muted)", marginTop: 8, fontSize: "0.9rem" }}>
            Your referral profile is being created. Refresh in a moment.
          </p>
        </div>
      )}
    </div>
  );
}
