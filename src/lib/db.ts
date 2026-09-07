import { PrismaClient } from "@prisma/client";

/**
 * Singleton do PrismaClient seguro em hot reload do Next.js dev server.
 * Sem o cache em `globalThis`, cada recarregamento de módulo criaria uma
 * nova conexão e esgotaria o pool.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
