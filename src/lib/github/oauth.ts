/**
 * GitHub OAuth — Web Application Flow. Só fica ativo quando
 * `isGithubOAuthEnabled` é true (client id + secret configurados). Escopo
 * mínimo (`read:user`), sem acesso a repositórios privados.
 */

import { env, isGithubOAuthEnabled } from "@/lib/env";

const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const OAUTH_SCOPE = "read:user";

export function buildAuthorizeUrl(state: string, redirectUri: string): string {
  if (!env.githubClientId) {
    throw new Error("GITHUB_CLIENT_ID não está configurado.");
  }
  const params = new URLSearchParams({
    client_id: env.githubClientId,
    redirect_uri: redirectUri,
    scope: OAUTH_SCOPE,
    state,
    allow_signup: "true",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

interface GithubTokenApiResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

export interface GithubTokenResult {
  accessToken: string;
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
): Promise<GithubTokenResult> {
  if (!isGithubOAuthEnabled) {
    throw new Error("GitHub OAuth não está configurado.");
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: env.githubClientId,
      client_secret: env.githubClientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error("Falha ao trocar código por token de acesso do GitHub.");
  }

  const data = (await response.json()) as GithubTokenApiResponse;
  if (!data.access_token) {
    throw new Error(
      data.error_description ?? "GitHub não retornou um token de acesso.",
    );
  }
  return { accessToken: data.access_token };
}

export interface GithubAuthenticatedUser {
  login: string;
  id: number;
  name: string | null;
  avatarUrl: string | null;
}

interface GithubUserApiResponse {
  login: string;
  id: number;
  name: string | null;
  avatar_url: string | null;
}

export async function fetchAuthenticatedUser(
  accessToken: string,
): Promise<GithubAuthenticatedUser> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    throw new Error("Falha ao buscar o usuário autenticado no GitHub.");
  }

  const data = (await response.json()) as GithubUserApiResponse;
  return {
    login: data.login,
    id: data.id,
    name: data.name,
    avatarUrl: data.avatar_url,
  };
}
