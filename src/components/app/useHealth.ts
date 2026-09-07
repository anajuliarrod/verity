"use client";

import { useEffect, useState } from "react";
import { getHealth } from "@/lib/api-client";
import type { HealthStatus } from "@/lib/types";

export interface UseHealthResult {
  health: HealthStatus | null;
  loading: boolean;
  error: string | null;
}

/** Busca `GET /api/health` uma vez; falha silenciosamente na UI (sem quebrar a tela). */
export function useHealth(): UseHealthResult {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getHealth()
      .then((data) => {
        if (!cancelled) setHealth(data);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível consultar o status do sistema.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { health, loading, error };
}
