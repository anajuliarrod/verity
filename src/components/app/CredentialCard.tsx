import type { ReactNode } from "react";
import { VerityMark } from "@/components/brand/VerityMark";
import { cn, formatDate, truncateAddress } from "@/lib/utils";
import type { VerityAttestation } from "@/lib/types";

export interface CredentialCardProps {
  attestation: VerityAttestation;
  className?: string;
  /** Ações renderizadas abaixo do cartão (copiar link, explorer, detalhes). */
  footer?: ReactNode;
}

function SolanaMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 32"
      width="34"
      height="27"
      fill="none"
      role="img"
      aria-label="Solana"
      className={className}
    >
      <defs>
        <linearGradient id="verity-solana-grad-a" x1="0" y1="0" x2="40" y2="32">
          <stop offset="0%" stopColor="#9945FF" />
          <stop offset="100%" stopColor="#14F195" />
        </linearGradient>
      </defs>
      <path
        d="M6.5 21.5h27.7c.7 0 1 .8.5 1.3l-5.6 5.6a1.7 1.7 0 0 1-1.2.5H0c-.7 0-1-.8-.5-1.3l6-6a1.7 1.7 0 0 1 1-.4Z"
        fill="url(#verity-solana-grad-a)"
      />
      <path
        d="M6.5 3.3h27.7c.7 0 1 .8.5 1.3l-5.6 5.6a1.7 1.7 0 0 1-1.2.5H0c-.7 0-1-.8-.5-1.3l6-6a1.7 1.7 0 0 1 1-.5Z"
        fill="url(#verity-solana-grad-a)"
      />
      <path
        d="M33.5 12.3H5.8c-.7 0-1 .8-.5 1.3l5.6 5.6c.3.3.7.5 1.2.5h27.7c.7 0 1-.8.5-1.3l-5.6-5.6a1.7 1.7 0 0 0-1.2-.5Z"
        fill="url(#verity-solana-grad-a)"
      />
    </svg>
  );
}

/**
 * O cartão escuro "Proof of Contribution": peça central do produto,
 * recriada a partir do key visual. `mode === "mock"` exibe uma marca
 * discreta e honesta de modo demonstração; nunca finge ser on-chain real.
 */
export function CredentialCard({ attestation, className, footer }: CredentialCardProps) {
  const { payload, mode } = attestation;
  const isMock = mode === "mock";

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="grad-night relative overflow-hidden rounded-card p-5 text-white shadow-[0_16px_40px_rgba(7,9,57,0.35)] sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl"
        />

        <div className="relative flex items-start justify-between">
          <VerityMark size={30} />
          <SolanaMark />
        </div>

        <div className="relative mt-6">
          <p className="font-display text-lg font-semibold leading-tight sm:text-xl">
            Proof of Contribution
          </p>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
            Verified on Solana
          </p>
        </div>

        <div className="relative mt-5 flex flex-col gap-1 text-sm text-white/85">
          <p className="truncate font-medium">{payload.project}</p>
          <p className="truncate text-white/65">{payload.contribution}</p>
          <p className="mt-1 text-xs text-white/50">
            Emitida em {formatDate(attestation.issuedAt)}
          </p>
        </div>

        <div className="relative mt-5 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-verity-verified-bg px-2.5 py-1 text-xs font-semibold text-verity-verified">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path
                d="M2.5 6.2 4.8 8.5 9.5 3.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Credencial válida
          </span>
          <span className="font-mono text-xs text-white/50">
            {truncateAddress(attestation.subjectWallet)}
          </span>
        </div>

        {isMock && (
          <div className="relative mt-4 rounded-input border border-white/15 bg-white/10 px-2.5 py-1.5 text-[11px] font-medium text-white/80">
            Modo demonstração: assinatura simulada, sem transação real na Solana.
          </div>
        )}
      </div>

      {footer}
    </div>
  );
}
