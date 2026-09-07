/**
 * Construção do payload da credencial on-chain `verity.poc.v1` (seção 6 do
 * VERITY_BRIEF.md) e seu hash canônico. Este módulo é puro (sem I/O) para
 * ser fácil de testar e reutilizar tanto na emissão (`attest.ts`) quanto na
 * verificação (`verifyAttestation.ts`).
 */
import type {
  ContributionType,
  ContributionStatus,
  CredentialPayload,
} from "@/lib/types";
import { sha256Hex } from "@/lib/utils";

export interface CredentialSourceContribution {
  repoOwner: string;
  repoName: string;
  type: ContributionType;
  externalId: string;
  url: string;
  occurredAt: Date | string;
}

export interface CredentialSourceUser {
  wallet: string;
}

export interface CredentialSourceVerification {
  status: ContributionStatus;
  evidenceHash: string;
  evaluatedAt: string;
}

function toIsoString(value: Date | string): string {
  return typeof value === "string" ? value : value.toISOString();
}

function contributionLabel(type: ContributionType, externalId: string): string {
  switch (type) {
    case "PULL_REQUEST":
      return `Pull Request #${externalId}`;
    case "COMMIT":
      return `Commit ${externalId.slice(0, 7)}`;
    case "ISSUE":
      return `Issue #${externalId}`;
    case "REVIEW":
      return `Review em PR #${externalId}`;
    default:
      return externalId;
  }
}

/** Monta o payload `verity.poc.v1` a partir da contribuição verificada. */
export function buildCredentialPayload(
  contribution: CredentialSourceContribution,
  user: CredentialSourceUser,
  verification: CredentialSourceVerification,
): CredentialPayload {
  return {
    schema: "verity.poc.v1",
    type: "GitHub Contribution",
    subject: user.wallet,
    issuer: "Verity Proof of Contribution",
    project: `${contribution.repoOwner}/${contribution.repoName}`,
    contribution: contributionLabel(contribution.type, contribution.externalId),
    contributionUrl: contribution.url,
    occurredAt: toIsoString(contribution.occurredAt),
    verifiedAt: verification.evaluatedAt,
    evidenceHash: verification.evidenceHash,
    status: verification.status,
  };
}

/** Serialização canônica (chaves ordenadas) para hashing determinístico. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const entries = keys.map(
    (key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`,
  );
  return `{${entries.join(",")}}`;
}

/** sha256 hex do payload serializado canonicamente (chaves ordenadas). */
export function hashPayload(payload: CredentialPayload): string {
  return sha256Hex(canonicalJson(payload));
}
