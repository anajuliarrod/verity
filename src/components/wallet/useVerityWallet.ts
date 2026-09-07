"use client";

import { useCallback, useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { env } from "@/lib/env";

export interface VerityWalletState {
  address: string | null;
  connected: boolean;
  connecting: boolean;
  cluster: string;
  disconnect: () => Promise<void>;
}

/**
 * Embrulha `useWallet()` do wallet-adapter e sincroniza a wallet conectada
 * com a sessão do servidor via `POST /api/session/wallet` (rota de outro
 * agente). A sincronização é best-effort: se a rota ainda não existir ou a
 * chamada falhar, a wallet segue conectada e utilizável na UI. Nunca
 * quebra por causa disso.
 */
export function useVerityWallet(): VerityWalletState {
  const { publicKey, connected, connecting, disconnect } = useWallet();
  const address = publicKey?.toBase58() ?? null;
  const syncedAddress = useRef<string | null>(null);

  useEffect(() => {
    if (!connected || !address || syncedAddress.current === address) return;
    syncedAddress.current = address;

    fetch("/api/session/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: address }),
    }).catch(() => {
      // Best-effort: associação de sessão é um upgrade opcional aqui.
    });
  }, [connected, address]);

  const handleDisconnect = useCallback(async () => {
    syncedAddress.current = null;
    await disconnect();
  }, [disconnect]);

  return {
    address,
    connected,
    connecting,
    cluster: env.solanaCluster,
    disconnect: handleDisconnect,
  };
}
