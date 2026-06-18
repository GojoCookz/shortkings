"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

export default function AuthForm({ mode }: { mode: Mode }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const isSignup = mode === "signup";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        // New accounts only get created from the signup page.
        shouldCreateUser: isSignup,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });

    if (error) {
      setStatus("error");
      setError(error.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">$SHORT</div>
        <h1 className="auth-title">{isSignup ? "Join the Court" : "Welcome Back, King"}</h1>
        <p className="auth-sub">
          {isSignup
            ? "Enter your email — we'll send a magic link. No passwords, no stool required."
            : "Enter your email and we'll send you a magic sign-in link."}
        </p>

        {status === "sent" ? (
          <p className="auth-msg ok">
            👑 Check your inbox — we sent a magic link to <b>{email}</b>. Click it to{" "}
            {isSignup ? "finish signing up" : "sign in"}.
          </p>
        ) : (
          <form onSubmit={onSubmit}>
            <input
              className="auth-field"
              type="email"
              required
              autoComplete="email"
              placeholder="you@kingdom.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email address"
            />
            <button className="auth-btn" type="submit" disabled={status === "sending"}>
              {status === "sending" ? "Sending…" : isSignup ? "Send my magic link" : "Send sign-in link"}
            </button>
            {status === "error" && <p className="auth-msg err">{error}</p>}
          </form>
        )}

        <p className="auth-foot">
          {isSignup ? (
            <>Already a King? <Link href="/login">Log in</Link></>
          ) : (
            <>New here? <Link href="/signup">Create your account</Link></>
          )}
        </p>
        <Link className="auth-home" href="/">← Back to shortkings.xyz</Link>
      </div>
    </div>
  );
}
