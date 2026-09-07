"use client";

import { useEffect } from "react";

/**
 * Define `document.title` como `${title} · VERITY` enquanto o componente
 * chamador está montado, e restaura o título anterior ao desmontar. Resolve
 * o achado M2 da auditoria de UX: hoje o título da aba é fixo em todas as
 * telas do grupo `(app)`.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · VERITY`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
