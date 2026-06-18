import type { WalletContextState } from "@solana/wallet-adapter-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Sign in with the connected Solana wallet via Supabase Web3 auth.
 *
 * The wallet signs a Sign-In-With-Solana message (no gas, no funds moved);
 * Supabase verifies the signature server-side and mints a session. On first
 * sign-in the handle_new_user() trigger creates the profile + referral code.
 * Afterwards we stamp the wallet address onto the profile.
 *
 * Requires the **Web3 Wallet (Solana)** provider to be enabled in the Supabase
 * dashboard (Authentication → Sign In / Providers).
 */
export async function signInWithWallet(wallet: WalletContextState) {
  const supabase = createClient();

  // The wallet-adapter and auth-js packages declare structurally-identical but
  // nominally-different Solana sign-in types, so we cast to the method's own
  // param type. Runtime is exactly the documented wallet-adapter usage.
  const { error } = await supabase.auth.signInWithWeb3({
    chain: "solana",
    statement: "Sign in to Short Kings to earn $SHORT XP.",
    wallet,
  } as Parameters<typeof supabase.auth.signInWithWeb3>[0]);
  if (error) throw error;

  // Best-effort: record the wallet address on the profile (sets only if null).
  const addr = wallet.publicKey?.toBase58();
  if (addr) {
    await supabase.rpc("set_wallet_address", { p_addr: addr });
  }
}
