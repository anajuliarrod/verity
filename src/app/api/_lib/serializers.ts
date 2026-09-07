/**
 * Conversão dos modelos Prisma (campos JSON armazenados como `String`) para
 * os DTOs de `src/lib/types.ts` expostos pela API.
 */

import type {
  Attestation as PrismaAttestation,
  Contribution as PrismaContribution,
  User as PrismaUser,
} from "@prisma/client";
import type {
  AttestationMode,
  ContributionStatus,
  ContributionType,
  CredentialPayload,
  SourceKind,
  VerificationResult,
  VerityAttestation,
  VerityContribution,
  VerityUser,
} from "@/lib/types";

function safeParseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function serializeUser(user: PrismaUser): VerityUser {
  return {
    id: user.id,
    wallet: user.wallet,
    githubUsername: user.githubUsername,
    githubId: user.githubId,
    name: user.name,
    headline: user.headline,
    bio: user.bio,
    course: user.course,
    institution: user.institution,
    location: user.location,
    websiteUrl: user.websiteUrl,
    avatarUrl: user.avatarUrl,
    handle: user.handle,
    createdAt: user.createdAt.toISOString(),
  };
}

export function serializeAttestation(attestation: PrismaAttestation): VerityAttestation {
  const payload = safeParseJson<CredentialPayload>(attestation.payload) ?? {
    schema: "verity.poc.v1",
    type: "GitHub Contribution",
    subject: attestation.subjectWallet,
    issuer: "Verity Proof of Contribution",
    project: "",
    contribution: "",
    contributionUrl: "",
    occurredAt: attestation.issuedAt.toISOString(),
    verifiedAt: attestation.issuedAt.toISOString(),
    evidenceHash: "",
    status: "VERIFIED",
  };

  return {
    id: attestation.id,
    contributionId: attestation.contributionId,
    issuer: attestation.issuer,
    issuerPubkey: attestation.issuerPubkey,
    subjectWallet: attestation.subjectWallet,
    network: attestation.network,
    mode: attestation.mode as AttestationMode,
    signature: attestation.signature,
    attestationPda: attestation.attestationPda,
    explorerUrl: attestation.explorerUrl,
    payload,
    issuedAt: attestation.issuedAt.toISOString(),
  };
}

type ContributionWithAttestation = PrismaContribution & {
  attestation?: PrismaAttestation | null;
};

export function serializeContribution(
  contribution: ContributionWithAttestation,
): VerityContribution {
  return {
    id: contribution.id,
    userId: contribution.userId,
    source: contribution.source as SourceKind,
    repoOwner: contribution.repoOwner,
    repoName: contribution.repoName,
    type: contribution.type as ContributionType,
    externalId: contribution.externalId,
    title: contribution.title,
    url: contribution.url,
    occurredAt: contribution.occurredAt.toISOString(),
    status: contribution.status as ContributionStatus,
    evidence: safeParseJson<VerificationResult>(contribution.evidence),
    raw: safeParseJson<Record<string, unknown>>(contribution.raw),
    attestation: contribution.attestation
      ? serializeAttestation(contribution.attestation)
      : null,
  };
}
