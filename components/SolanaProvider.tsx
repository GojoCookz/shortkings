"use client";

import { useMemo } from "react";
import { clusterApiUrl } from "@solana/web3.js";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

/**
 * Solana wallet context for the whole app.
 *
 * Wallets are auto-detected via the Wallet Standard (Phantom, Solflare,
 * Backpack, Coinbase, Rainbow-on-Solana, etc. register themselves), so we pass
 * an empty `wallets` array rather than hardcoding adapters.
 *
 * RPC endpoint comes from NEXT_PUBLIC_SOLANA_RPC; falls back to the public
 * mainnet-beta endpoint (rate-limited — set a Helius/QuickNode URL for prod).
 */
export default function SolanaProvider({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl("mainnet-beta"),
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
