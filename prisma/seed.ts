import { PrismaClient } from "@prisma/client";
import { DEMO_USER, getDemoContributions } from "../src/lib/demo";
import { verifyContribution } from "../src/lib/verification";
import { AttestationInputError, issueAttestation } from "../src/lib/solana/attest";
import type { ContributionType } from "../src/lib/types";

const prisma = new PrismaClient();

/**
 * Semeia a Emanuelly demo com o dataset determinístico de contribuições
 * (algumas já verificadas, uma propositalmente rejeitada) e emite
 * attestations para as verificadas, para que `/p/emanuelly` tenha conteúdo
 * real logo após `npm run db:seed`. Idempotente: upsert por chave única —
 * nunca reemite uma attestation que já existe.
 *
 * Só a primeira contribuição verificada tenta emissão real (sas -> memo,
 * conforme `VERITY_ISSUER_SECRET_KEY`); as demais são emitidas em modo
 * `mock` de propósito, para não gastar SOL/tempo de devnet a cada seed e
 * para a UI mostrar os dois modos lado a lado, sempre rotulados com honestidade.
 */
async function main() {
  const user = await prisma.user.upsert({
    where: { handle: DEMO_USER.handle },
    update: {
      name: DEMO_USER.name,
      headline: DEMO_USER.headline,
      githubUsername: DEMO_USER.githubUsername,
      avatarUrl: DEMO_USER.avatarUrl,
      wallet: DEMO_USER.wallet,
    },
    create: {
      handle: DEMO_USER.handle,
      name: DEMO_USER.name,
      headline: DEMO_USER.headline,
      githubUsername: DEMO_USER.githubUsername,
      avatarUrl: DEMO_USER.avatarUrl,
      wallet: DEMO_USER.wallet,
    },
  });

  const contributions = getDemoContributions(DEMO_USER.githubUsername);

  let verifiedCount = 0;
  let attestedCount = 0;
  let realAttestationIssued = false;

  for (const contribution of contributions) {
    const result = verifyContribution(
      {
        type: contribution.type,
        repoOwner: contribution.repoOwner,
        repoName: contribution.repoName,
        raw: contribution.raw as unknown as Record<string, unknown>,
      },
      { githubUsername: user.githubUsername },
    );

    const saved = await prisma.contribution.upsert({
      where: {
        userId_source_repoOwner_repoName_type_externalId: {
          userId: user.id,
          source: contribution.source,
          repoOwner: contribution.repoOwner,
          repoName: contribution.repoName,
          type: contribution.type,
          externalId: contribution.externalId,
        },
      },
      update: {
        title: contribution.title,
        url: contribution.url,
        occurredAt: new Date(contribution.occurredAt),
        raw: JSON.stringify(contribution.raw),
        status: result.status,
        evidence: JSON.stringify(result),
      },
      create: {
        userId: user.id,
        source: contribution.source,
        repoOwner: contribution.repoOwner,
        repoName: contribution.repoName,
        type: contribution.type as ContributionType,
        externalId: contribution.externalId,
        title: contribution.title,
        url: contribution.url,
        occurredAt: new Date(contribution.occurredAt),
        raw: JSON.stringify(contribution.raw),
        status: result.status,
        evidence: JSON.stringify(result),
      },
    });

    if (result.status === "VERIFIED") {
      verifiedCount += 1;

      const existingAttestation = await prisma.attestation.findUnique({
        where: { contributionId: saved.id },
      });

      if (!existingAttestation) {
        const forceMode = realAttestationIssued ? "mock" : undefined;
        try {
          const issued = await issueAttestation({
            contributionId: saved.id,
            forceMode,
          });
          await prisma.attestation.create({
            data: {
              contributionId: saved.id,
              issuer: issued.issuer,
              issuerPubkey: issued.issuerPubkey,
              subjectWallet: issued.subjectWallet,
              network: issued.network,
              mode: issued.mode,
              signature: issued.signature,
              attestationPda: issued.attestationPda,
              explorerUrl: issued.explorerUrl,
              payload: JSON.stringify(issued.payload),
            },
          });
          attestedCount += 1;
          if (issued.mode !== "mock") realAttestationIssued = true;
          console.log(
            `  attestation [${issued.mode}] emitida para ${contribution.repoOwner}/${contribution.repoName} (${contribution.type})`,
          );
        } catch (error) {
          if (error instanceof AttestationInputError) {
            console.warn(`  attestation não emitida (${error.message})`);
          } else {
            throw error;
          }
        }
      } else {
        attestedCount += 1;
      }
    }
  }

  console.log(
    `Seed concluído: usuário @${user.handle} com ${contributions.length} contribuições ` +
      `(${verifiedCount} verificadas, ${attestedCount} com credencial emitida).`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
