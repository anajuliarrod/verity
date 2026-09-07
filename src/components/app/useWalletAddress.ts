"use client";

import { useVerityWallet } from "@/components/wallet";

/**
 * Lê o endereço da wallet conectada via `useVerityWallet` (o hook oficial
 * de `src/components/wallet/**`, que já sincroniza a sessão com
 * `POST /api/session/wallet`). Fino wrapper apenas para expor a forma
 * mínima usada pelas telas deste agente.
 */
export function useWalletAddress(): { address: string | null; connected: boolean } {
  const { address, connected } = useVerityWallet();
  return { address, connected };
}
