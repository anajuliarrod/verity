import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "primary" | "verified" | "warning" | "danger";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-verity-bg text-verity-ink-muted border border-verity-border",
  primary: "bg-verity-tint text-verity-primary",
  verified: "bg-verity-verified-bg text-verity-verified",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-600",
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone = "neutral", ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-medium",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  ),
);
Badge.displayName = "Badge";
