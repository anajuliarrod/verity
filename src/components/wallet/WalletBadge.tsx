"use client";

import { cn, truncateAddress } from "@/lib/utils";
import { useVerityWallet } from "./useVerityWallet";

export interface WalletBadgeProps {
  className?: string;
}

/** Pill compacta com a rede e o endereço truncado da wallet conectada. */
export function WalletBadge({ className }: WalletBadgeProps) {
  const { address, connected, cluster } = useVerityWallet();

  if (!connected || !address) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border border-verity-border bg-white px-2.5 py-1 text-xs font-medium text-verity-ink-muted",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-solana-teal" aria-hidden="true" />
      <span className="uppercase tracking-wide text-[10px] text-verity-ink-muted/80">
        {cluster}
      </span>
      <span className="text-verity-ink">{truncateAddress(address)}</span>
    </span>
  );
}
