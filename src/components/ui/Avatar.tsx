import { cn } from "@/lib/utils";
import Image from "next/image";

export interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}

function initialOf(name?: string | null): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

/** Avatar com imagem; cai para um círculo roxo com a inicial do nome. */
export function Avatar({ src, name, size = 40, className }: AvatarProps) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name ?? "Avatar"}
        width={size}
        height={size}
        className={cn("rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={name ?? "Avatar"}
      className={cn(
        "flex items-center justify-center rounded-full bg-verity-primary font-display font-semibold text-white",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initialOf(name)}
    </div>
  );
}
