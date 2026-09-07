/**
 * Contrato de tipos compartilhado da Verity.
 *
 * Este arquivo é a fonte da verdade dos tipos usados por API, UI, engine de
 * verificação e integração Solana. Baseado nas seções 3, 4, 5 e 6 do
 * VERITY_BRIEF.md. Alterações aqui afetam todos os agentes — mantenha
 * compatível com o schema Prisma (`prisma/schema.prisma`).
 *
 * Datas são sempre representadas como string ISO 8601 nos DTOs de API
 * (nunca `Date`), já que atravessam JSON.
 */

// ---------------------------------------------------------------------------
// Enums / literais de domínio
// ---------------------------------------------------------------------------

export type ContributionType = "PULL_REQUEST" | "COMMIT" | "ISSUE" | "REVIEW";

export type ContributionStatus = "PENDING" | "VERIFIED" | "REJECTED";

/** Modo de emissão da attestation, em ordem de degradação graciosa. */
export type AttestationMode = "sas" | "memo" | "mock";

/** Origem de uma contribuição. Hoje só "github", mas o tipo já é extensível. */
export type SourceKind = "github";

// ---------------------------------------------------------------------------
// DTOs de domínio (o que a API expõe)
// ---------------------------------------------------------------------------

export interface VerityUser {
  id: string;
  wallet: string | null;
  githubUsername: string | null;
  githubId: string | null;
  name: string | null;
  headline: string | null;
  avatarUrl: string | null;
  handle: string;
  createdAt: string;
}

export interface VerityContribution {
  id: string;
  userId: string;
  source: SourceKind;
  repoOwner: string;
  repoName: string;
  type: ContributionType;
  externalId: string;
  title: string;
  url: string;
  occurredAt: string;
  status: ContributionStatus;
  evidence: VerificationResult | null;
  raw: Record<string, unknown> | null;
  attestation: VerityAttestation | null;
}

export interface VerityAttestation {
  id: string;
  contributionId: string;
  issuer: string;
  issuerPubkey: string | null;
  subjectWallet: string;
  network: string;
  mode: AttestationMode;
  signature: string | null;
  attestationPda: string | null;
  explorerUrl: string | null;
  payload: CredentialPayload;
  issuedAt: string;
}

// ---------------------------------------------------------------------------
// Verification Engine (seção 5 do brief)
// ---------------------------------------------------------------------------

export interface VerificationRuleResult {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
  /** Peso opcional: regras informativas (não bloqueiam) usam `weight` baixo/0. */
  weight?: number;
}

export interface VerificationResult {
  status: ContributionStatus;
  rules: VerificationRuleResult[];
  evaluatedAt: string;
  /** sha256 hex do snapshot de evidência usado no payload da credencial. */
  evidenceHash: string;
}

// ---------------------------------------------------------------------------
// Payload da credencial on-chain (seção 6 do brief) — verity.poc.v1
// ---------------------------------------------------------------------------

export interface CredentialPayload {
  schema: "verity.poc.v1";
  type: "GitHub Contribution";
  subject: string;
  issuer: "Verity Proof of Contribution";
  project: string;
  contribution: string;
  contributionUrl: string;
  occurredAt: string;
  verifiedAt: string;
  evidenceHash: string;
  status: ContributionStatus;
}

// ---------------------------------------------------------------------------
// Envelope de resposta da API
// ---------------------------------------------------------------------------

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "GITHUB_ERROR"
  | "SOLANA_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface ApiOk<T> {
  ok: true;
  data: T;
}

export interface ApiErr {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

export type ApiResponse<T> = ApiOk<T> | ApiErr;

export function apiOk<T>(data: T): ApiOk<T> {
  return { ok: true, data };
}

export function apiErr(code: ApiErrorCode, message: string): ApiErr {
  return { ok: false, error: { code, message } };
}

// ---------------------------------------------------------------------------
// Perfil público e saúde do sistema
// ---------------------------------------------------------------------------

export interface PublicProfile {
  handle: string;
  name: string | null;
  headline: string | null;
  avatarUrl: string | null;
  wallet: string | null;
  githubUsername: string | null;
  verifiedContributions: VerityContribution[];
  stats: {
    totalContributions: number;
    verifiedCount: number;
    projectsCount: number;
  };
}

export interface HealthStatus {
  ok: boolean;
  modes: {
    github: "live" | "token" | "demo";
    solana: AttestationMode;
    db: "connected" | "unreachable";
  };
  /** Se `true`, o servidor tem GitHub OAuth configurado (client id + secret). */
  githubOAuth: boolean;
  demoMode: boolean;
  timestamp: string;
}

/**
 * Resultado de reler uma attestation diretamente da rede Solana (PDA para
 * `sas`, transação para `memo`) e comparar o hash contra o que está
 * gravado no banco — a checagem independente que dá credibilidade a
 * `/verify/[attestationId]`.
 */
export interface VerifyOnChainResult {
  onChain: boolean;
  matches: boolean;
  checkedAt: string;
  detail: string;
}

/** Resposta pública de `GET /api/attestations/:id`. */
export interface AttestationPublicView {
  attestation: VerityAttestation;
  contribution: VerityContribution;
  verification: VerifyOnChainResult;
}

// ---------------------------------------------------------------------------
// Filtros e fluxo de UI
// ---------------------------------------------------------------------------

export interface ContributionFilters {
  status?: ContributionStatus;
  type?: ContributionType;
  repo?: string;
  search?: string;
}

/** Os 5 passos do fluxo do usuário (seção 7 do brief), usados pelo StepFlow. */
export type StepId =
  | "connect_wallet"
  | "connect_github"
  | "find_contributions"
  | "verify_contribution"
  | "issue_attestation";
