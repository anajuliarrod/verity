/**
 * Montagem do perfil público de reputação, direto da camada de dados.
 *
 * Extraído de `GET /api/profile/:handle` para que a página
 * `src/app/p/[handle]/page.tsx` (um Server Component) possa buscar os
 * mesmos dados sem dar a volta desnecessária de chamar a própria API por
 * HTTP. A rota de API continua existindo e chama esta mesma função: o
 * comportamento observável de `GET /api/profile/:handle` não muda.
 *
 * Só expõe contribuições com status `VERIFIED` (com suas attestations) e
 * nenhum dado sensível, igual à rota original.
 *
 * O handle público pode mudar (ex.: era derivado da wallet e passa a ser
 * derivado do GitHub ao vincular a conta). Para que um link já compartilhado
 * não vire 404, também procura por `previousHandle` quando não há match
 * direto: o perfil retornado usa o handle atual do usuário, então quem
 * chama (a página em `src/app/p/[handle]/page.tsx`) percebe a diferença e
 * redireciona para o handle correto.
 *
 * `previousHandle` é aditivo (migration `20260907223000_previous_handle`) e
 * pode ainda não existir no banco em produção no momento em que este código
 * é implantado. Por isso a busca pelo handle atual usa `select` explícito
 * (nunca toca a coluna nova) e a busca pelo handle anterior é isolada e
 * tolerante a essa coluna ainda não existir, para que um handle válido
 * continue funcionando normalmente enquanto a migration não é aplicada.
 */

import { db } from "@/lib/db";
import type { PublicProfile } from "@/lib/types";
import { serializeContribution } from "@/app/api/_lib/serializers";

const PUBLIC_PROFILE_USER_SELECT = {
  id: true,
  handle: true,
  name: true,
  headline: true,
  bio: true,
  course: true,
  institution: true,
  location: true,
  websiteUrl: true,
  avatarUrl: true,
  wallet: true,
  githubUsername: true,
} as const;

type PublicProfileUser = {
  id: string;
  handle: string;
  name: string | null;
  headline: string | null;
  bio: string | null;
  course: string | null;
  institution: string | null;
  location: string | null;
  websiteUrl: string | null;
  avatarUrl: string | null;
  wallet: string | null;
  githubUsername: string | null;
};

interface PrismaKnownError {
  code: string;
}

function isMissingColumnError(error: unknown): error is PrismaKnownError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as PrismaKnownError).code === "P2022"
  );
}

async function findUserByPreviousHandle(handle: string): Promise<PublicProfileUser | null> {
  try {
    return await db.user.findUnique({
      where: { previousHandle: handle },
      select: PUBLIC_PROFILE_USER_SELECT,
    });
  } catch (error) {
    if (isMissingColumnError(error)) return null;
    throw error;
  }
}

/** Retorna `null` quando não existe usuário com este handle nem com este handle anterior. */
export async function getPublicProfile(handle: string): Promise<PublicProfile | null> {
  const user =
    (await db.user.findUnique({ where: { handle }, select: PUBLIC_PROFILE_USER_SELECT })) ??
    (await findUserByPreviousHandle(handle));
  if (!user) return null;

  const [totalContributions, verifiedRecords] = await Promise.all([
    db.contribution.count({ where: { userId: user.id } }),
    db.contribution.findMany({
      where: { userId: user.id, status: "VERIFIED" },
      include: { attestation: true },
      orderBy: { occurredAt: "desc" },
    }),
  ]);

  const verifiedContributions = verifiedRecords.map(serializeContribution);
  const projectsCount = new Set(
    verifiedRecords.map((record) => `${record.repoOwner}/${record.repoName}`),
  ).size;

  return {
    handle: user.handle,
    name: user.name,
    headline: user.headline,
    bio: user.bio,
    course: user.course,
    institution: user.institution,
    location: user.location,
    websiteUrl: user.websiteUrl,
    avatarUrl: user.avatarUrl,
    wallet: user.wallet,
    githubUsername: user.githubUsername,
    verifiedContributions,
    stats: {
      totalContributions,
      verifiedCount: verifiedContributions.length,
      projectsCount,
    },
  };
}
