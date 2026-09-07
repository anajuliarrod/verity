import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Cabeçalho padrão das telas do grupo `(app)`, com uma trilha de
 * localização de um nível ("VERITY / {title}") acima do `<h1>`. Resolve o
 * achado PM-3 da auditoria de UX: hoje a única pista de "onde estou" é o
 * item ativo da Sidebar, invisível em mobile. Não é breadcrumb de múltiplos
 * níveis porque a hierarquia real do produto tem só um nível.
 */
export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-verity-ink-muted">
          VERITY / {title}
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold text-verity-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-verity-ink-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
