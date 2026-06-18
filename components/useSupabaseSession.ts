"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * Tracks the current Supabase auth user on the client and stays in sync with
 * sign-in / sign-out events (including wallet sign-in via signInWithWeb3).
 */
export function useSupabaseSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    // A single ordered source of truth. onAuthStateChange fires INITIAL_SESSION
    // immediately on subscribe, then SIGNED_IN / SIGNED_OUT — so there's no
    // getUser() round-trip racing against (and clobbering) a fresher event.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, loading };
}
