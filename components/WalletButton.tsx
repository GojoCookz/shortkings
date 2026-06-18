"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

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
  const { connection } = useConnection();
  const { publicKey, connected, connecting, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  const [mounted, setMounted] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

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
        if (!cancelled) setBalance(null); // RPC error -> show fallback label
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

  const onDisconnect = useCallback(() => {
    setMenuOpen(false);
    disconnect().catch(() => {});
  }, [disconnect]);

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

  if (!connected) {
    return (
      <button
        className="btn btn-gold topnav-cta wallet-btn"
        type="button"
        onClick={openConnectModal}
        disabled={connecting}
      >
        {connecting ? "Connecting…" : "Connect"}
      </button>
    );
  }

  const balanceLabel = loadingBalance
    ? "… SHORT"
    : balance == null
      ? "SHORT"
      : `${formatAmount(balance)} SHORT`;

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
          <div className="wallet-menu-addr">
            {publicKey ? shortAddr(publicKey.toBase58()) : ""}
          </div>
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
