/**
 * GET /api/auth/github/start — inicia o GitHub OAuth Web Application Flow
 * (se configurado). Gera `state` aleatório, grava em cookie httpOnly de
 * curta duração (proteção CSRF) e redireciona para a tela de autorização
 * do GitHub. Se OAuth não estiver configurado, devolve erro no envelope
 * padrão (a UI deve oferecer a vinculação manual como alternativa).
 */

import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isGithubOAuthEnabled } from "@/lib/env";
import { buildAuthorizeUrl } from "@/lib/github/oauth";
import { jsonFail, withErrorHandling } from "@/app/api/_lib/http";
import { OAUTH_STATE_COOKIE } from "@/app/api/_lib/oauthState";

export const GET = withErrorHandling(async (request) => {
  if (!isGithubOAuthEnabled) {
    return jsonFail(
      "VALIDATION_ERROR",
      "GitHub OAuth não está configurado neste ambiente. Use a vinculação manual em /settings.",
    );
  }

  const state = randomBytes(16).toString("hex");
  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/github/callback`;
  const authorizeUrl = buildAuthorizeUrl(state, redirectUri);

  return NextResponse.redirect(authorizeUrl);
});
