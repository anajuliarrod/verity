/**
 * Carrega o keypair emissor da Verity a partir de `VERITY_ISSUER_SECRET_KEY`.
 * Nunca lança na importação do módulo nem fora dela: retorna `null` sempre
 * que a chave estiver ausente ou for inválida, permitindo a degradação
 * graciosa sas -> memo -> mock em `attest.ts`.
 */
import bs58 from "bs58";
import { createKeyPairSignerFromBytes, type KeyPairSigner } from "@solana/kit";
import { env } from "@/lib/env";

const SECRET_KEY_BYTE_LENGTH = 64;

function parseSecretKeyBytes(raw: string): Uint8Array | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (
        Array.isArray(parsed) &&
        parsed.every((value) => typeof value === "number")
      ) {
        return Uint8Array.from(parsed as number[]);
      }
    } catch {
      return null;
    }
    return null;
  }

  try {
    return bs58.decode(trimmed);
  } catch {
    return null;
  }
}

async function loadIssuer(): Promise<KeyPairSigner | null> {
  const raw = env.verityIssuerSecretKey;
  if (!raw) return null;

  const bytes = parseSecretKeyBytes(raw);
  if (!bytes || bytes.length !== SECRET_KEY_BYTE_LENGTH) return null;

  try {
    return await createKeyPairSignerFromBytes(bytes);
  } catch {
    return null;
  }
}

let cachedIssuer: Promise<KeyPairSigner | null> | null = null;

/** Retorna o signer emissor (cacheado entre chamadas), ou `null`. Nunca lança. */
export function getIssuerSigner(): Promise<KeyPairSigner | null> {
  if (!cachedIssuer) cachedIssuer = loadIssuer();
  return cachedIssuer;
}
