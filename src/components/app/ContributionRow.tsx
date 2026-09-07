"use client";

import { useState, type ComponentType } from "react";
import type { ContributionStatus, ContributionType, VerityContribution } from "@/lib/types";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";
import { EvidencePanel } from "./EvidencePanel";
import {
  IconChevronDown,
  IconCommit,
  IconExternalLink,
  IconIssue,
  IconPullRequest,
  IconReview,
  type IconProps,
} from "./icons";

const TYPE_ICON: Record<ContributionType, ComponentType<IconProps>> = {
  PULL_REQUEST: IconPullRequest,
  COMMIT: IconCommit,
  ISSUE: IconIssue,
  REVIEW: IconReview,
};

const TYPE_LABEL: Record<ContributionType, string> = {
  PULL_REQUEST: "Pull Request",
  COMMIT: "Commit",
  ISSUE: "Issue",
  REVIEW: "Review",
};

const STATUS_TONE: Record<ContributionStatus, BadgeTone> = {
  PENDING: "neutral",
  VERIFIED: "verified",
  REJECTED: "danger",
};

const STATUS_LABEL: Record<ContributionStatus, string> = {
  PENDING: "Pendente",
  VERIFIED: "Verificada",
  REJECTED: "Rejeitada",
};

export interface ContributionRowProps {
  contribution: VerityContribution;
  verifying?: boolean;
  issuing?: boolean;
  onVerify: (id: string) => void;
  onIssueAttestation: (id: string) => void;
}

export function ContributionRow({
  contribution,
  verifying = false,
  issuing = false,
  onVerify,
  onIssueAttestation,
}: ContributionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const TypeIcon = TYPE_ICON[contribution.type];
  const panelId = `evidence-${contribution.id}`;

  return (
    <div className="rounded-card border border-verity-border bg-white">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-verity-tint text-verity-primary">
          <TypeIcon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-verity-ink-muted">
            <span className="font-medium text-verity-ink">
              {contribution.repoOwner}/{contribution.repoName}
            </span>
            <span aria-hidden="true">·</span>
            <span>{TYPE_LABEL[contribution.type]}</span>
            <span aria-hidden="true">·</span>
            <span>{formatDate(contribution.occurredAt)}</span>
          </div>
          <a
            href={contribution.url}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring mt-0.5 inline-flex items-center gap-1 rounded-input text-sm font-semibold text-verity-ink hover:text-verity-primary"
          >
            <span className="truncate">{contribution.title}</span>
            <IconExternalLink className="h-3.5 w-3.5 shrink-0 text-verity-ink-muted" />
          </a>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[contribution.status]}>
            {STATUS_LABEL[contribution.status]}
          </Badge>

          {contribution.status !== "VERIFIED" && (
            <Button
              size="sm"
              variant="secondary"
              loading={verifying}
              onClick={() => onVerify(contribution.id)}
            >
              Verificar
            </Button>
          )}

          {contribution.status === "VERIFIED" && !contribution.attestation && (
            <Button
              size="sm"
              variant="primary"
              loading={issuing}
              onClick={() => onIssueAttestation(contribution.id)}
            >
              Emitir credencial
            </Button>
          )}

          {contribution.attestation && (
            <Badge tone="primary">Credencial emitida</Badge>
          )}

          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setExpanded((current) => !current)}
            className="focus-ring rounded-input p-1.5 text-verity-ink-muted transition-transform hover:bg-verity-bg"
          >
            <IconChevronDown
              className={expanded ? "rotate-180 transition-transform" : "transition-transform"}
            />
            <span className="sr-only">
              {expanded ? "Ocultar evidências" : "Ver evidências"}
            </span>
          </button>
        </div>
      </div>

      {expanded && (
        <div id={panelId} className="border-t border-verity-border p-4">
          <EvidencePanel result={contribution.evidence} />
        </div>
      )}
    </div>
  );
}
