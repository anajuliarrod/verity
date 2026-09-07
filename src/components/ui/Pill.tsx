import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

/** Chip/pill selecionável, usado em filtros e navegação secundária. */
export const Pill = forwardRef<HTMLButtonElement, PillProps>(
  ({ className, active = false, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-pressed={active}
      className={cn(
        "focus-ring inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-transparent bg-verity-tint text-verity-primary"
          : "border-verity-border bg-white text-verity-ink-muted hover:bg-verity-bg",
        className,
      )}
      {...props}
    />
  ),
);
Pill.displayName = "Pill";
