"use client";

/**
 * Provider da pilha wallet-adapter (web3.js v1, client-side). Não misture
 * com `@solana/kit`/`sas-lib` (pilha server-side em `src/lib/solana/`).
 *
 * Não registra adapters específicos: o `WalletProvider` do
 * `@solana/wallet-adapter-react` detecta automaticamente carteiras que
 * implementam o Wallet Standard (Phantom, Solflare, Backpack, etc.), sem
 * precisar importar o barrel pesado `@solana/wallet-adapter-wallets`.
 */

import { useMemo, type ReactNode } from "react";
import { clusterApiUrl } from "@solana/web3.js";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { env } from "@/lib/env";

import "@solana/wallet-adapter-react-ui/styles.css";

export function SolanaProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(
    () => env.solanaRpc ?? clusterApiUrl("devnet"),
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
