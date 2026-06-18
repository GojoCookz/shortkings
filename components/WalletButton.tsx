"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { createClient } from "@/lib/supabase/client";
import { signInWithWallet } from "@/lib/supabase/walletSignIn";
import { useSupabaseSession } from "@/components/useSupabaseSession";

// $SHORT SPL token mint
const SHORT_MINT = new PublicKey("A8cMYsw7YaGmB1htaeF9bww4nGjN1czti5RNh2viBAGS");

/** 8_400_000 -> "8.4M", 12_300 -> "12.3K", 950 -> "950" */
function formatAmount(n: number): string {
  const trim = (x: number) => (x >= 100 ? x.toFixed(0) : x.toFixed(1)).replace(/\.0$/, "");
  if (n >= 1e9) return trim(n / 1e9) + "B";
  if (n >= 1e6) return trim(n / 1e6) + "M";
  if (n >= 1e3) return trim(n / 1e3) + "K";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export default function WalletButton() {
  const router = useRouter();
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey, connected, connecting, disconnect } = wallet;
  const { setVisible } = useWalletModal();
  const { user } = useSupabaseSession();

  const [mounted, setMounted] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // The wallet address bound to the active Supabase session (profiles.wallet_address).
  // undefined = not loaded yet, null = none on record.
  const [boundWallet, setBoundWallet] = useState<string | null | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const wasConnected = useRef(false);

  useEffect(() => setMounted(true), []);

  // Resolve the session's bound wallet, and stamp it on first sign-in if missing.
  useEffect(() => {
    if (!user) {
      setBoundWallet(undefined);
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const read = async () =>
        (await supabase.from("profiles").select("wallet_address").eq("id", user.id).single()).data
          ?.wallet_address ?? null;
      let addr = await read();
      if (!addr && connected && publicKey) {
        await supabase.rpc("set_wallet_address", { p_addr: publicKey.toBase58() });
        addr = await read();
      }
      if (!cancelled) setBoundWallet(addr);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, connected, publicKey]);

  // If a wallet-bound session loses its wallet (disconnected/locked outside the
  // app), sign out so the UI doesn't claim "logged out" while the session lives.
  useEffect(() => {
    if (wasConnected.current && !connected && user && boundWallet) {
      createClient()
        .auth.signOut()
        .then(() => router.refresh())
        .catch(() => {});
    }
    wasConnected.current = connected;
  }, [connected, user, boundWallet, router]);

  // Fetch $SHORT balance whenever the connected wallet changes.
  useEffect(() => {
    if (!connected || !publicKey) {
      setBalance(null);
      return;
    }
    let cancelled = false;
    setLoadingBalance(true);
    connection
      .getParsedTokenAccountsByOwner(publicKey, { mint: SHORT_MINT })
      .then((res) => {
        if (cancelled) return;
        const total = res.value.reduce((sum, { account }) => {
          const ui = account.data.parsed?.info?.tokenAmount?.uiAmount;
          return sum + (typeof ui === "number" ? ui : 0);
        }, 0);
        setBalance(total);
      })
      .catch(() => {
        if (!cancelled) setBalance(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingBalance(false);
      });
    return () => {
      cancelled = true;
    };
  }, [connected, publicKey, connection]);

  // Close the dropdown on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const openConnectModal = useCallback(() => setVisible(true), [setVisible]);

  const doSignIn = useCallback(async () => {
    setSigning(true);
    setSignError(false);
    try {
      await signInWithWallet(wallet);
      router.refresh();
    } catch {
      setSignError(true);
    } finally {
      setSigning(false);
    }
  }, [wallet, router]);

  const onDisconnect = useCallback(async () => {
    setMenuOpen(false);
    try {
      await createClient().auth.signOut();
    } catch {
      /* ignore */
    }
    disconnect().catch(() => {});
    router.refresh();
  }, [disconnect, router]);

  const copyAddress = useCallback(() => {
    if (publicKey) navigator.clipboard.writeText(publicKey.toBase58());
    setMenuOpen(false);
  }, [publicKey]);

  // Stable first render to avoid hydration mismatch before the adapter hydrates.
  if (!mounted) {
    return (
      <button className="btn btn-gold topnav-cta wallet-btn" type="button" disabled>
        Connect
      </button>
    );
  }

  // 1) No wallet connected → open the wallet picker.
  if (!connected) {
    return (
      <button className="btn btn-gold topnav-cta wallet-btn" type="button" onClick={openConnectModal} disabled={connecting}>
        {connecting ? "Connecting…" : "Connect"}
      </button>
    );
  }

  // The connected wallet doesn't match the wallet that owns the session
  // (user switched accounts in their wallet) → require a re-sign as the new one.
  const mismatch = !!(user && publicKey && boundWallet && publicKey.toBase58() !== boundWallet);

  // 2) Connected but not signed in (or signed in as a different wallet) → sign.
  if (!user || mismatch) {
    return (
      <button className="btn btn-gold topnav-cta wallet-btn" type="button" onClick={doSignIn} disabled={signing}>
        {signing ? "Sign…" : signError ? "Retry sign-in" : "Sign In"}
      </button>
    );
  }

  // 3) Signed in → show balance + dropdown.
  const balanceLabel = loadingBalance ? "… SHORT" : balance == null ? "SHORT" : `${formatAmount(balance)} SHORT`;

  return (
    <div className="wallet-wrap" ref={wrapRef}>
      <button
        className="btn btn-gold topnav-cta wallet-btn"
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        title={publicKey ? publicKey.toBase58() : undefined}
      >
        {balanceLabel}
      </button>
      {menuOpen && (
        <div className="wallet-menu" role="menu">
          <div className="wallet-menu-addr">{publicKey ? shortAddr(publicKey.toBase58()) : "Signed in"}</div>
          <Link className="wallet-menu-item" href="/dashboard" onClick={() => setMenuOpen(false)}>
            Dashboard
          </Link>
          <a className="wallet-menu-item" href="#tasks" onClick={() => setMenuOpen(false)}>
            Tasks &amp; XP
          </a>
          <button className="wallet-menu-item" type="button" onClick={copyAddress}>
            Copy address
          </button>
          <button className="wallet-menu-item danger" type="button" onClick={onDisconnect}>
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
