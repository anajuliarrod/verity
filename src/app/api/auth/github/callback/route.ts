/**
 * GET /api/auth/github/callback: callback do GitHub OAuth. Valida `state`
 * contra o cookie gravado em `/start` (CSRF), troca o `code` por um token
 * de acesso, busca o usuário autenticado e vincula à sessão atual.
 *
 * Por ser um redirecionamento de navegador (parte do fluxo OAuth padrão),
 * esta rota não devolve o envelope JSON. Redireciona de volta para
 * `/settings` com um parâmetro de resultado que a UI usa para mostrar
 * sucesso/erro.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exchangeCodeForToken, fetchAuthenticatedUser } from "@/lib/github/oauth";
import { getSessionUserId } from "@/lib/session";
import { generateGithubHandle, isWalletDerivedHandle } from "@/app/api/_lib/handle";
import { OAUTH_STATE_COOKIE } from "@/app/api/_lib/oauthState";

function settingsRedirect(request: Request, result: string): NextResponse {
  const origin = new URL(request.url).origin;
  const url = new URL("/settings", origin);
  url.searchParams.set("github", result);
  return NextResponse.redirect(url);
}

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

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const store = await cookies();
  const expectedState = store.get(OAUTH_STATE_COOKIE)?.value;
  store.delete(OAUTH_STATE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    return settingsRedirect(request, "state_mismatch");
  }

  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) {
    return settingsRedirect(request, "no_session");
  }

  try {
    const origin = url.origin;
    const redirectUri = `${origin}/api/auth/github/callback`;
    const { accessToken } = await exchangeCodeForToken(code, redirectUri);
    const githubUser = await fetchAuthenticatedUser(accessToken);

    const currentUser = await db.user.findUnique({ where: { id: sessionUserId } });
    if (!currentUser) {
      return settingsRedirect(request, "no_session");
    }

    const nextHandle = isWalletDerivedHandle(currentUser.handle)
      ? await generateGithubHandle(githubUser.login)
      : currentUser.handle;

    await db.user.update({
      where: { id: currentUser.id },
      data: {
        githubUsername: githubUser.login,
        githubId: String(githubUser.id),
        name: currentUser.name ?? githubUser.name,
        avatarUrl: currentUser.avatarUrl ?? githubUser.avatarUrl,
        handle: nextHandle,
      },
    });

    return settingsRedirect(request, "connected");
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return settingsRedirect(request, "already_linked");
    }
    console.error("[api] erro no callback do GitHub OAuth:", error);
    return settingsRedirect(request, "error");
  }
}
