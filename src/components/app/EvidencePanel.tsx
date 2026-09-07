import type { VerificationResult } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { IconAlert, IconCheckCircle, IconXCircle } from "./icons";

export interface EvidencePanelProps {
  result: VerificationResult | null;
}

/**
 * Mostra o resultado do Verification Engine regra a regra, com ✓/✗ e o
 * `detail` em pt-BR. Mostrar por que uma regra falhou é tão importante
 * quanto mostrar que passou: é o que prova que a verificação é real.
 */
export function EvidencePanel({ result }: EvidencePanelProps) {
  if (!result) {
    return (
      <div className="flex items-start gap-2 rounded-input border border-dashed border-verity-border bg-verity-bg px-3 py-3 text-sm text-verity-ink-muted">
        <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Esta contribuição ainda não foi verificada. Clique em &quot;Verificar&quot;
          para rodar o Verification Engine.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-input border border-verity-border bg-verity-bg p-3">
      <ul className="flex flex-col gap-2.5">
        {result.rules.map((rule) => (
          <li key={rule.id} className="flex items-start gap-2.5">
            {rule.passed ? (
              <IconCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-verity-verified" />
            ) : (
              <IconXCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            )}
            <div>
              <p className="text-sm font-medium text-verity-ink">
                {rule.label}
                {typeof rule.weight === "number" && rule.weight === 0 && (
                  <span className="ml-2 text-xs font-normal text-verity-ink-muted">
                    (informativa)
                  </span>
                )}
              </p>
              <p className="text-xs text-verity-ink-muted">{rule.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-col gap-1 border-t border-verity-border pt-3 text-xs text-verity-ink-muted sm:flex-row sm:items-center sm:justify-between">
        <span>Avaliado em {formatDateTime(result.evaluatedAt)}</span>
        <span className="break-all font-mono">
          hash: {result.evidenceHash}
        </span>
      </div>
    </div>
  );
}
