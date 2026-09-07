"use client";

import { useEffect } from "react";
import { VerityMark } from "@/components/brand/VerityMark";
import { Button } from "@/components/ui/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-verity-bg px-6 text-center">
      <VerityMark size={48} />
      <h1 className="font-display text-3xl font-bold text-verity-ink">Algo deu errado</h1>
      <p className="max-w-sm text-sm text-verity-ink-muted">
        Não foi possível carregar esta página. Tente novamente em instantes.
      </p>
      <Button variant="primary" onClick={reset}>
        Tentar novamente
      </Button>
    </main>
  );
}
