import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { resolveSqlitePath } from "./sqlite-path";

// Standard Next.js dev-mode singleton: hot reload re-evaluates this module
// on every edit, and without caching the instance on `globalThis` each
// reload would open a fresh SQLite connection and eventually exhaust file
// handles.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const absolutePath = resolveSqlitePath(url);
  const adapter = new PrismaBetterSqlite3({ url: `file:${absolutePath}` });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
