import { cn } from "@/lib/utils";

export interface VerifiedBadgeProps {
  label?: string;
  className?: string;
}

/** Pill verde "Verificado" com ícone de check, conforme identidade visual. */
export function VerifiedBadge({ label = "Verificado", className }: VerifiedBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill bg-verity-verified-bg px-2.5 py-1 text-xs font-semibold text-verity-verified",
        className,
      )}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path
          d="M2.5 6.2 L4.8 8.5 L9.5 3.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </span>
  );
}
