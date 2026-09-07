import { cn } from "@/lib/utils";
import type { StepId } from "@/lib/types";
import { IconCheckCircle } from "./icons";

export type StepStatus = "todo" | "current" | "done";

export interface StepFlowStep {
  id: StepId;
  status: StepStatus;
}

export interface StepFlowProps {
  steps: StepFlowStep[];
  className?: string;
}

const STEP_META: Record<StepId, { title: string; description: string }> = {
  connect_wallet: {
    title: "Conectar wallet",
    description: "Associe uma wallet Solana à sua conta.",
  },
  connect_github: {
    title: "Conectar GitHub",
    description: "Vincule seu usuário para buscarmos contribuições.",
  },
  find_contributions: {
    title: "Contribuições encontradas",
    description: "PRs, commits e issues elegíveis para verificação.",
  },
  verify_contribution: {
    title: "Verificação",
    description: "O Verification Engine confere as regras.",
  },
  issue_attestation: {
    title: "Emitir credencial",
    description: "A prova é registrada on-chain, na Solana.",
  },
};

/**
 * Progresso visual dos 5 passos do fluxo (seção 7 do brief). O estado de
 * cada passo é derivado pelo chamador a partir do estado real do usuário —
 * este componente só renderiza.
 */
export function StepFlow({ steps, className }: StepFlowProps) {
  return (
    <ol className={cn("relative", className)}>
      <div
        aria-hidden="true"
        className="absolute left-5 top-5 hidden h-0.5 bg-verity-border md:right-5 md:left-5 md:block"
      />
      <div className="flex flex-col gap-5 md:flex-row md:justify-between md:gap-2">
        {steps.map((step, index) => {
          const meta = STEP_META[step.id];
          const isLast = index === steps.length - 1;
          return (
            <li
              key={step.id}
              className="relative flex items-start gap-3 md:flex-1 md:flex-col md:items-center md:text-center"
            >
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-white text-sm font-semibold",
                    step.status === "done" &&
                      "border-verity-verified bg-verity-verified text-white",
                    step.status === "current" &&
                      "border-verity-primary text-verity-primary",
                    step.status === "todo" &&
                      "border-verity-border text-verity-ink-muted",
                  )}
                >
                  {step.status === "done" ? (
                    <IconCheckCircle className="h-5 w-5" />
                  ) : (
                    index + 1
                  )}
                </span>
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-1 h-6 w-0.5 bg-verity-border md:hidden",
                      step.status === "done" && "bg-verity-verified",
                    )}
                  />
                )}
              </div>
              <div className="pb-1 md:px-1">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    step.status === "todo"
                      ? "text-verity-ink-muted"
                      : "text-verity-ink",
                  )}
                >
                  {meta.title}
                </p>
                <p className="mt-0.5 hidden text-xs text-verity-ink-muted md:block">
                  {meta.description}
                </p>
              </div>
            </li>
          );
        })}
      </div>
    </ol>
  );
}
