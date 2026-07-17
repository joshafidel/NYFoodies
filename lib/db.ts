import { PrismaClient } from "@prisma/client";

/**
 * Lazy Prisma singleton. The whole app must keep working without a database
 * (localStorage mode) — call dbConfigured() before using db().
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function dbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function db(): PrismaClient {
  if (!dbConfigured()) {
    throw new Error("DATABASE_URL is not configured — Instagram sync features are disabled");
  }
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }
  return globalForPrisma.prisma;
}
