import path from "node:path";

/**
 * Resolves a `file:...` DATABASE_URL to an absolute path, relative to
 * prisma/ (matching where Prisma itself resolves a relative sqlite URL
 * from, since the schema lives at prisma/schema.prisma). Both
 * prisma/bootstrap.ts and src/lib/db.ts must agree on this resolution, or
 * they end up reading/writing two different database files.
 */
export function resolveSqlitePath(databaseUrl: string): string {
  const withoutScheme = databaseUrl.replace(/^file:/, "");
  if (path.isAbsolute(withoutScheme)) return withoutScheme;
  return path.resolve(process.cwd(), "prisma", withoutScheme);
}
