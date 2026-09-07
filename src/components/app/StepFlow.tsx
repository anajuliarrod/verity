import { cn } from "@/lib/utils";
import type { StepId } from "@/lib/types";
import { IconCheckCircle } from "./icons";

export type StepStatus = "todo" | "current" | "done";

export interface StepFlowStep {
  id: StepId;
  status: StepStatus;
  /**
   * Ação disparada ao ativar o passo (clique, Enter ou Espaço). Só produz
   * efeito visual quando `status === "current"`: é o que resolve o achado
   * C1 da auditoria de UX, "o StepFlow não aciona nada".
   */
  onAction?: () => void;
  /**
   * Sobrescreve o rótulo acessível padrão do passo atual. Por padrão o
   * rótulo já descreve a ação (não só o título do passo), para que faça
   * sentido lido isoladamente por leitor de tela.
   */
  actionLabel?: string;
}

export interface StepFlowProps {
  steps: StepFlowStep[];
  className?: string;
}

const STEP_META: Record<StepId, { title: string; description: string; action: string }> = {
  connect_wallet: {
    title: "Conectar wallet",
    description: "Associe uma wallet Solana à sua conta.",
    action: "Conectar wallet: abrir seleção de carteira",
  },
  connect_github: {
    title: "Conectar GitHub",
    description: "Vincule seu usuário para buscarmos contribuições.",
    action: "Conectar GitHub: ir para o formulário de vínculo",
  },
  find_contributions: {
    title: "Contribuições encontradas",
    description: "PRs, commits e issues elegíveis para verificação.",
    action: "Ver contribuições encontradas",
  },
  verify_contribution: {
    title: "Verificação",
    description: "O Verification Engine confere as regras.",
    action: "Ir verificar contribuições pendentes",
  },
  issue_attestation: {
    title: "Emitir credencial",
    description: "A prova é registrada on-chain, na Solana.",
    action: "Ir emitir credencial de uma contribuição verificada",
  },
};

const ITEM_LAYOUT_CLASS =
  "flex w-full items-start gap-3 text-left md:flex-col md:items-center md:text-center";

/**
 * Progresso visual e acionável dos 5 passos do fluxo (seção 7 do brief). O
 * estado de cada passo é derivado pelo chamador a partir do estado real do
 * usuário; este componente decide apenas como renderizar. O passo atual,
 * quando tem `onAction`, vira um `<button>` de verdade: alcançável por Tab,
 * ativável por Enter e Espaço, com `aria-label` que descreve a ação.
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
          const clickable = step.status === "current" && Boolean(step.onAction);

          const circleBlock = (
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
          );

          const textBlock = (
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
          );

          return (
            <li key={step.id} className="relative md:flex-1">
              {clickable ? (
                <button
                  type="button"
                  onClick={step.onAction}
                  aria-label={step.actionLabel ?? meta.action}
                  className={cn(
                    ITEM_LAYOUT_CLASS,
                    "focus-ring cursor-pointer rounded-input transition-colors hover:bg-verity-tint/60 md:rounded-card",
                  )}
                >
                  {circleBlock}
                  {textBlock}
                </button>
              ) : (
                <div
                  className={ITEM_LAYOUT_CLASS}
                  aria-disabled={step.status === "todo" ? true : undefined}
                >
                  {circleBlock}
                  {textBlock}
                </div>
              )}
            </li>
          );
        })}
      </div>
    </ol>
  );
}

export interface StepFlowCompactProps {
  /** O passo atual, já com `onAction` (se houver) injetado pelo chamador. */
  step: StepFlowStep | null;
  className?: string;
}

/**
 * Versão compacta do `StepFlow`: mostra só o passo atual, como uma pílula.
 * Usada em `/contributions` e `/credentials` (item 4.4 da auditoria de UX),
 * onde o fluxo completo de 5 passos seria repetição do Dashboard.
 */
export function StepFlowCompact({ step, className }: StepFlowCompactProps) {
  if (!step) return null;
  const meta = STEP_META[step.id];
  const label = step.actionLabel ?? meta.action;

  if (!step.onAction) {
    return (
      <div
        className={cn(
          "inline-flex w-fit items-center gap-2 rounded-pill border border-verity-border bg-white px-3 py-1.5 text-sm text-verity-ink-muted",
          className,
        )}
      >
        <span className="h-2 w-2 rounded-full bg-verity-primary" aria-hidden="true" />
        Próximo passo: {meta.title}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={step.onAction}
      aria-label={label}
      className={cn(
        "focus-ring inline-flex w-fit items-center gap-2 rounded-pill border border-verity-primary/30 bg-verity-tint px-3 py-1.5 text-sm font-medium text-verity-primary transition-colors hover:bg-verity-tint/70",
        className,
      )}
    >
      <span className="h-2 w-2 rounded-full bg-verity-primary" aria-hidden="true" />
      Próximo passo: {meta.title}
    </button>
  );
}
