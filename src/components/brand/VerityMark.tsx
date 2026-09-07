"use client";

import { useId } from "react";

export interface VerityMarkProps {
  /** Tamanho (largura e altura) em pixels. */
  size?: number;
  /** `gradient` usa as cores da marca; `mono` usa `currentColor`. */
  variant?: "gradient" | "mono";
  className?: string;
}

/**
 * Símbolo da Verity: um "V" composto por duas fitas com gradiente e uma
 * dobra escura na junção, mais um sparkle de 4 pontas no canto superior
 * direito. Recriado como SVG a partir de `brand/verity-mark.png`.
 */
export function VerityMark({
  size = 40,
  variant = "gradient",
  className,
}: VerityMarkProps) {
  const uid = useId();
  const leftGradId = `verity-mark-left-${uid}`;
  const rightGradId = `verity-mark-right-${uid}`;

  const isMono = variant === "mono";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      role="img"
      aria-label="Verity"
      className={className}
    >
      <defs>
        <linearGradient id={leftGradId} x1="20" y1="18" x2="48" y2="82" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#CBB6FB" />
          <stop offset="100%" stopColor="#754CFF" />
        </linearGradient>
        <linearGradient id={rightGradId} x1="48" y1="30" x2="80" y2="82" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#CBB6FB" />
          <stop offset="55%" stopColor="#8E53FD" />
          <stop offset="100%" stopColor="#3C09D2" />
        </linearGradient>
      </defs>

      {/* Fita esquerda: clara -> média */}
      <path
        d="M18 20 C17 18 19 16.5 21 17 L44 17.5 C46 17.6 47.6 18.8 48.4 20.6 L58 44 L47 71 C45.6 74.4 41 74.6 39.2 71.4 L18 20Z"
        fill={isMono ? "currentColor" : `url(#${leftGradId})`}
        opacity={isMono ? 0.55 : 1}
      />

      {/* Fita direita: clara -> profunda, cria a perna direita do V */}
      <path
        d="M50 40 C51 37.6 53 36 55.5 36 L78 35.6 C80.4 35.5 81.8 38.2 80.5 40.2 L52 82.4 C50.4 84.8 46.8 84.4 45.8 81.6 L40 65.5 L50 40Z"
        fill={isMono ? "currentColor" : `url(#${rightGradId})`}
      />

      {/* Dobra interna escura: profundidade na junção das duas fitas */}
      <path
        d="M39.5 44 C43 47.2 45.8 51.4 47.4 56.2 L40 65.5 L33 49.6 C35.2 47.2 37.3 45.4 39.5 44Z"
        fill={isMono ? "currentColor" : "#3C09D2"}
        opacity={isMono ? 0.85 : 0.9}
      />

      {/* Sparkle de 4 pontas, canto superior direito */}
      <path
        d="M83 14 C83.8 19 86.6 21.8 91.6 22.6 C86.6 23.4 83.8 26.2 83 31.2 C82.2 26.2 79.4 23.4 74.4 22.6 C79.4 21.8 82.2 19 83 14Z"
        fill={isMono ? "currentColor" : "#8E53FD"}
      />
    </svg>
  );
}
