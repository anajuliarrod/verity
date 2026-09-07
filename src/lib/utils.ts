import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { createHash } from "crypto";

/** Combina classes condicionalmente e resolve conflitos do Tailwind. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Formata uma data (ISO string ou Date) no padrão pt-BR. */
export function formatDate(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
  },
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "N/D";
  return new Intl.DateTimeFormat("pt-BR", options).format(date);
}

/** Formata data + hora no padrão pt-BR. */
export function formatDateTime(value: string | Date): string {
  return formatDate(value, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Trunca um endereço de wallet: `7xKX...gAsU`. */
export function truncateAddress(
  address: string,
  visibleChars = 4,
): string {
  if (address.length <= visibleChars * 2 + 3) return address;
  return `${address.slice(0, visibleChars)}...${address.slice(-visibleChars)}`;
}

/** SHA-256 em hexadecimal, usado no hash de evidência das credenciais. */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
