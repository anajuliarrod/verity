"use client";

import { useState, type FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ApiError, githubOAuthStartUrl, linkGithub } from "@/lib/api-client";
import type { VerityUser } from "@/lib/types";
import { IconGithub } from "./icons";

export interface GithubLinkCardProps {
  /** Vem de `HealthStatus.githubOAuth` — `true` quando o servidor tem client id + secret configurados. */
  oauthAvailable?: boolean;
  onLinked: (user: VerityUser) => void;
  className?: string;
}

export function GithubLinkCard({ oauthAvailable = false, onLinked, className }: GithubLinkCardProps) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!username.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const user = await linkGithub(username.trim());
      onLinked(user);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Não foi possível vincular o GitHub agora. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Conectar GitHub</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm">
          Vincule seu usuário do GitHub para buscarmos automaticamente Pull
          Requests, commits e issues elegíveis para verificação.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="github-username" className="sr-only">
            Usuário do GitHub
          </label>
          <input
            id="github-username"
            name="github-username"
            type="text"
            autoComplete="off"
            placeholder="seu-usuario-github"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="focus-ring h-10 flex-1 rounded-input border border-verity-border bg-white px-3 text-sm text-verity-ink placeholder:text-verity-ink-muted"
          />
          <Button type="submit" loading={loading} disabled={!username.trim()}>
            Vincular
          </Button>
        </form>

        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {oauthAvailable && (
          <>
            <div className="my-4 flex items-center gap-3 text-xs text-verity-ink-muted">
              <span className="h-px flex-1 bg-verity-border" />
              ou
              <span className="h-px flex-1 bg-verity-border" />
            </div>
            <a href={githubOAuthStartUrl()} className="block">
              <Button variant="dark" className="w-full">
                <IconGithub className="h-4 w-4" />
                Conectar com GitHub
              </Button>
            </a>
          </>
        )}
      </CardContent>
    </Card>
  );
}
