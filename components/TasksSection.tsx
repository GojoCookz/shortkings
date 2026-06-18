"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { signInWithWallet } from "@/lib/supabase/walletSignIn";
import { useSupabaseSession } from "@/components/useSupabaseSession";

type TaskRow = {
  key: string;
  title: string;
  description: string;
  xp: number;
  frequency: "once" | "daily" | "cooldown";
  cooldown_seconds: number | null;
  action_type: "click" | "tweet" | "external";
  action_url: string | null;
  sort_order: number;
  done: boolean;
  last_completed_at: string | null;
};

const RANKS: [number, string][] = [
  [0, "Pawn"],
  [250, "Squire"],
  [750, "Knight"],
  [1500, "Baron"],
  [3000, "Duke"],
  [6000, "King"],
  [12000, "Emperor of Shorts"],
];

function rankFor(xp: number) {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (xp >= RANKS[i][0]) idx = i;
  const [floor, name] = RANKS[idx];
  const next = RANKS[idx + 1];
  const pct = next ? Math.min(100, Math.round(((xp - floor) / (next[0] - floor)) * 100)) : 100;
  return { name, next: next?.[1] ?? null, nextAt: next?.[0] ?? null, pct };
}

function fmtCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s % 60}s`;
}

export default function TasksSection() {
  const router = useRouter();
  const wallet = useWallet();
  const { connected, connecting } = wallet;
  const { setVisible } = useWalletModal();
  const { user, loading: authLoading } = useSupabaseSession();
  const supabase = useMemo(() => createClient(), []);

  const [tasks, setTasks] = useState<TaskRow[] | null>(null);
  const [xp, setXp] = useState(0);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [now, setNow] = useState(0);

  // Tick for cooldown countdowns (client-only; starts after mount).
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    const [tasksRes, xpRes, profRes] = await Promise.all([
      supabase.rpc("my_tasks"),
      supabase.rpc("my_xp"),
      supabase.from("profiles").select("referral_code").single(),
    ]);
    if (!tasksRes.error && tasksRes.data) setTasks(tasksRes.data as TaskRow[]);
    if (!xpRes.error && typeof xpRes.data === "number") setXp(xpRes.data);
    if (!profRes.error && profRes.data) setReferralCode(profRes.data.referral_code);
  }, [supabase]);

  useEffect(() => {
    if (user) load();
    else {
      setTasks(null);
      setXp(0);
    }
  }, [user, load]);

  const flashMsg = (m: string) => {
    setFlash(m);
    setTimeout(() => setFlash(null), 2500);
  };

  const doSignIn = useCallback(async () => {
    setSigning(true);
    try {
      await signInWithWallet(wallet);
      router.refresh();
    } catch (e) {
      flashMsg(e instanceof Error ? `Sign-in failed: ${e.message}` : "Sign-in failed");
    } finally {
      setSigning(false);
    }
  }, [wallet, router]);

  const shareUrl = useCallback(
    (task: TaskRow) => {
      if (task.action_url) return task.action_url;
      if (task.key === "share_referral" && referralCode) {
        const base =
          process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
          (typeof window !== "undefined" ? window.location.origin : "");
        const link = `${base}/?ref=${referralCode}`;
        const text = "Long live the Short Kings. 👑 Join the $SHORT hotline:";
        return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`;
      }
      return null;
    },
    [referralCode]
  );

  const complete = useCallback(
    async (task: TaskRow) => {
      setBusy(task.key);
      try {
        if (task.action_type === "tweet" || task.action_type === "external") {
          const url = shareUrl(task);
          if (!url) {
            // e.g. share_referral before the referral code has loaded — don't
            // award XP for a share that never opened.
            flashMsg("Link still loading — try again in a sec");
            return;
          }
          window.open(url, "_blank", "noopener");
        }
        const { data, error } = await supabase.rpc("complete_task", { p_task_key: task.key });
        if (error) {
          flashMsg(error.message);
          return;
        }
        const res = data as { status: string; awarded: number; total_xp: number };
        if (res.status === "ok") flashMsg(`+${res.awarded} XP 👑`);
        else if (res.status === "already") flashMsg("Already claimed");
        else if (res.status === "cooldown") flashMsg("Still on cooldown");
        if (typeof res.total_xp === "number") setXp(res.total_xp);
        await load();
      } finally {
        setBusy(null);
      }
    },
    [supabase, shareUrl, load]
  );

  // ---- Gated states ----------------------------------------------------------
  if (authLoading) {
    return <div className="tasks-gate"><p>Loading your quest board…</p></div>;
  }

  if (!user) {
    return (
      <div className="tasks-gate">
        <span className="tasks-gate-icon" aria-hidden="true">⚔️</span>
        <h3>{connected ? "One signature to start" : "Connect to start your quest"}</h3>
        <p>
          {connected
            ? "Sign a quick message with your wallet (free, no transaction) to prove it's you and start stacking $SHORT XP."
            : "Connect your Solana wallet, sign in, and earn $SHORT XP for checking in, repping on X, and growing the kingdom."}
        </p>
        {connected ? (
          <button className="tasks-cta" type="button" onClick={doSignIn} disabled={signing}>
            {signing ? "Check your wallet…" : "Sign in with wallet"}
          </button>
        ) : (
          <button className="tasks-cta" type="button" onClick={() => setVisible(true)} disabled={connecting}>
            {connecting ? "Connecting…" : "Connect wallet"}
          </button>
        )}
        {flash && <div className="xp-flash err">{flash}</div>}
      </div>
    );
  }

  // ---- Signed in: XP + board -------------------------------------------------
  const rank = rankFor(xp);

  return (
    <div>
      <div className="xp-header">
        <div className="xp-rank">
          <span className="xp-crown" aria-hidden="true">👑</span> {rank.name}
        </div>
        <div className="xp-total">{xp.toLocaleString()} <span>SHORT XP</span></div>
        <div className="xp-bar">
          <div className="xp-bar-fill" style={{ width: `${rank.pct}%` }} />
        </div>
        <div className="xp-next">
          {rank.next ? `${(rank.nextAt! - xp).toLocaleString()} XP to ${rank.next}` : "Max rank reached 👑"}
        </div>
        {flash && <div className="xp-flash">{flash}</div>}
      </div>

      <div className="task-grid">
        {(tasks ?? []).map((task) => {
          const lastMs = task.last_completed_at ? Date.parse(task.last_completed_at) : 0;
          const cdMs = (task.cooldown_seconds ?? 0) * 1000;
          const cooling = task.frequency === "cooldown" && lastMs > 0 && now > 0 && now < lastMs + cdMs;
          const isDone = task.done; // once/daily already claimed this period
          const disabled = busy === task.key || isDone || cooling;

          let label: string;
          if (isDone) label = "Claimed ✓";
          else if (cooling) label = `Ready in ${fmtCountdown(lastMs + cdMs - now)}`;
          else if (busy === task.key) label = "…";
          else if (task.action_type === "tweet") label = `Tweet · +${task.xp}`;
          else if (task.action_type === "external") label = `Open · +${task.xp}`;
          else label = `Claim · +${task.xp}`;

          return (
            <div className={`task-card${isDone ? " done" : ""}`} key={task.key}>
              <div className="tc-top">
                <span className="tc-freq">{task.frequency === "daily" ? "Daily" : task.frequency === "cooldown" ? "Repeatable" : "One-time"}</span>
                <span className="tc-xp">+{task.xp} XP</span>
              </div>
              <h3 className="tc-title">{task.title}</h3>
              <p className="tc-desc">{task.description}</p>
              <button className="tc-btn" type="button" disabled={disabled} onClick={() => complete(task)}>
                {label}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
