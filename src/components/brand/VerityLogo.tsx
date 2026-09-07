import { cn } from "@/lib/utils";
import { VerityMark } from "./VerityMark";

export interface VerityLogoProps {
  showTagline?: boolean;
  size?: "sm" | "md" | "lg";
  theme?: "light" | "dark";
  className?: string;
}

const SIZE_MAP: Record<
  NonNullable<VerityLogoProps["size"]>,
  { mark: number; word: string; tagline: string }
> = {
  sm: { mark: 24, word: "text-base", tagline: "text-[9px]" },
  md: { mark: 36, word: "text-xl", tagline: "text-[10px]" },
  lg: { mark: 52, word: "text-3xl", tagline: "text-xs" },
};

/** Símbolo + wordmark VERITY + tagline opcional. */
export function VerityLogo({
  showTagline = false,
  size = "md",
  theme = "light",
  className,
}: VerityLogoProps) {
  const dims = SIZE_MAP[size];
  const inkColor = theme === "dark" ? "text-white" : "text-verity-ink";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <VerityMark size={dims.mark} />
      <div className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display font-bold uppercase tracking-[0.22em]",
            dims.word,
            inkColor,
          )}
        >
          Verity
        </span>
        {showTagline && (
          <span
            className={cn(
              "mt-1 font-sans font-medium uppercase tracking-[0.14em] text-verity-primary",
              dims.tagline,
            )}
          >
            Seu trabalho. Verificado.
          </span>
        )}
      </div>
    </div>
  );
}
