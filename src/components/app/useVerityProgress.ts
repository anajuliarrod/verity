"use client";

import { useMemo } from "react";
import type { StepId, VerityContribution, VerityUser } from "@/lib/types";
import type { StepFlowStep, StepStatus } from "./StepFlow";

/** Os 5 passos do fluxo do usuário (seção 7 do brief), na ordem exibida. */
export const VERITY_STEP_ORDER: StepId[] = [
  "connect_wallet",
  "connect_github",
  "find_contributions",
  "verify_contribution",
  "issue_attestation",
];

export interface UseVerityProgressInput {
  connected: boolean;
  user: VerityUser | null;
  contributions: VerityContribution[] | null;
}

export interface VerityProgress {
  /** Status de cada um dos 5 passos, sem `onAction`: cada tela injeta a sua. */
  steps: StepFlowStep[];
  /** O primeiro passo ainda não concluído, ou `null` se todos já estiverem. */
  current: StepFlowStep | null;
}

/**
 * Deriva o status dos 5 passos do fluxo a partir do estado real do usuário.
 * Extraído do Dashboard (item 4.4 da auditoria de UX) para ser reaproveitado
 * também em `/contributions` e `/credentials`, em vez de duplicar o cálculo.
 */
export function useVerityProgress({
  connected,
  user,
  contributions,
}: UseVerityProgressInput): VerityProgress {
  return useMemo(() => {
    const done: Record<StepId, boolean> = {
      connect_wallet: connected,
      connect_github: Boolean(user?.githubUsername),
      find_contributions: Boolean(contributions && contributions.length > 0),
      verify_contribution: Boolean(contributions?.some((c) => c.status === "VERIFIED")),
      issue_attestation: Boolean(contributions?.some((c) => c.attestation)),
    };

    let currentAssigned = false;
    const steps: StepFlowStep[] = VERITY_STEP_ORDER.map((id) => {
      if (done[id]) return { id, status: "done" as StepStatus };
      if (!currentAssigned) {
        currentAssigned = true;
        return { id, status: "current" as StepStatus };
      }
      return { id, status: "todo" as StepStatus };
    });

    const current = steps.find((step) => step.status === "current") ?? null;
    return { steps, current };
  }, [connected, user, contributions]);
}
