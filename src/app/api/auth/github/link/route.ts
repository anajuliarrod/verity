/**
 * POST /api/auth/github/link: vincula um username do GitHub manualmente
 * (modo sem OAuth). Tenta enriquecer com dados públicos do GitHub (nome,
 * avatar, id), mas nunca bloqueia o vínculo se essa chamada falhar.
 * Zero-setup: a régua de verificação continua funcionando com o username.
 *
 * DELETE /api/auth/github/link: desvincula o GitHub da sessão atual.
 * Decisão de produto: as contribuições e credenciais já importadas
 * permanecem intactas (`Contribution`/`Attestation` referenciam `userId`,
 * não o username do GitHub, e uma attestation já emitida é prova on-chain
 * que continua válida independentemente do vínculo atual). Desvincular só
 * impede novas sincronizações (`GET /api/contributions?refresh=1` só busca
 * no GitHub quando `user.githubUsername` está preenchido) até que um
 * GitHub seja vinculado de novo.
 */

import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getOctokit, mapGithubError } from "@/lib/github/client";
import { HttpError, jsonOk, readJsonBody, withErrorHandling } from "@/app/api/_lib/http";
import { serializeUser } from "@/app/api/_lib/serializers";
import { generateGithubHandle, isWalletDerivedHandle } from "@/app/api/_lib/handle";
import { enforceRateLimit } from "@/app/api/_lib/rateLimit";

const bodySchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Informe um username do GitHub.")
    .max(39)
    .regex(/^[a-zA-Z0-9-]+$/, "Username do GitHub inválido."),
});

interface GithubPublicUser {
  id: number;
  name: string | null;
  avatar_url: string | null;
}

export const POST = withErrorHandling(async (request) => {
  const user = await requireUser();
  if (!user) {
    throw new HttpError("UNAUTHORIZED", "É necessário estar em uma sessão ativa.");
  }

  // Esta rota chama a API pública do GitHub sempre (não é desligada pelo
  // modo demo), então fica sujeita ao rate limit anônimo compartilhado por
  // toda a aplicação. Limite conservador por IP para não deixar um único
  // cliente esgotar a cota de todo mundo.
  enforceRateLimit(request, "github-link", 10, 5 * 60 * 1000);

  const { username } = bodySchema.parse(await readJsonBody(request));

  const existing = await db.user.findUnique({
    where: { githubUsername: username },
    select: { id: true },
  });
  if (existing && existing.id !== user.id) {
    throw new HttpError(
      "CONFLICT",
      "Este username do GitHub já está vinculado a outra conta.",
    );
  }

  let githubId: string | null = user.githubId;
  let name: string | null = user.name;
  let avatarUrl: string | null = user.avatarUrl;

  try {
    const octokit = getOctokit();
    const response = await octokit.request("GET /users/{username}", { username });
    const data = response.data as GithubPublicUser;
    githubId = String(data.id);
    name = user.name ?? data.name;
    avatarUrl = user.avatarUrl ?? data.avatar_url;
  } catch (error) {
    const mapped = mapGithubError(error);
    if (mapped.code === "NOT_FOUND") {
      throw new HttpError("VALIDATION_ERROR", "Usuário do GitHub não encontrado.");
    }
    // Rate limit ou erro transitório: segue com vínculo mínimo, sem bloquear o fluxo.
  }

  const nextHandle = isWalletDerivedHandle(user.handle)
    ? await generateGithubHandle(username)
    : user.handle;
  const handleChanged = nextHandle !== user.handle;

  try {
    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        githubUsername: username,
        githubId,
        name,
        avatarUrl,
        handle: nextHandle,
        // Guarda o handle antigo para que um link de perfil já compartilhado
        // (com o handle derivado da wallet) continue resolvendo: ver
        // `getPublicProfile` em `src/lib/server/profile.ts`.
        ...(handleChanged ? { previousHandle: user.handle } : {}),
      },
    });
    return jsonOk(serializeUser(updated));
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new HttpError(
        "CONFLICT",
        "Este username ou id do GitHub já está vinculado a outra conta.",
      );
    }
    throw error;
  }
});

export const DELETE = withErrorHandling(async () => {
  const user = await requireUser();
  if (!user) {
    throw new HttpError("UNAUTHORIZED", "É necessário estar em uma sessão ativa.");
  }
  if (!user.githubUsername) {
    throw new HttpError("VALIDATION_ERROR", "Nenhuma conta do GitHub vinculada a esta conta.");
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: { githubUsername: null, githubId: null },
  });

  return jsonOk(serializeUser(updated));
});

interface PrismaKnownError {
  code: string;
}

function isUniqueConstraintError(error: unknown): error is PrismaKnownError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as PrismaKnownError).code === "P2002"
  );
}
