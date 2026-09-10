// Local dev/test database bootstrap.
//
// Applies every migration under prisma/migrations/ directly through the
// better-sqlite3 native addon (in-process, not a spawned executable).
// This exists because `prisma migrate dev` / `db push` spawn a native
// schema-engine binary, and on this machine that binary is blocked by a
// Windows Device Guard / WDAC policy. See docs/architecture.md for details.
// On any unrestricted machine, `npx prisma migrate dev` works normally and
// reads the same migrations/ directory.
//
// Migrations are tracked in a `_bootstrap_migrations` bookkeeping table
// (this script's own equivalent of Prisma's `_prisma_migrations`), so
// re-running this against an existing database only applies migrations it
// hasn't seen yet, instead of the old all-or-nothing "skip if the file
// exists" behavior.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import "dotenv/config";
import { resolveSqlitePath } from "../src/lib/sqlite-path";

function main() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const dbPath = resolveSqlitePath(url);
  const migrationsDir = path.resolve(process.cwd(), "prisma/migrations");

  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS "_bootstrap_migrations" (
      "name" TEXT PRIMARY KEY,
      "appliedAt" DATETIME NOT NULL
    );
  `);

  const applied = new Set(
    db.prepare(`SELECT name FROM "_bootstrap_migrations"`).all().map((row) => (row as { name: string }).name)
  );

  const migrationDirs = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const markApplied = db.prepare(`INSERT INTO "_bootstrap_migrations" (name, appliedAt) VALUES (?, ?)`);

  let appliedCount = 0;
  for (const migrationName of migrationDirs) {
    if (applied.has(migrationName)) continue;

    const sqlPath = path.join(migrationsDir, migrationName, "migration.sql");
    if (!fs.existsSync(sqlPath)) continue;

    const sql = fs.readFileSync(sqlPath, "utf-8");
    const applyMigration = db.transaction(() => {
      db.exec(sql);
      markApplied.run(migrationName, new Date().toISOString());
    });
    applyMigration();

    console.log(`Applied migration ${migrationName} to ${dbPath}`);
    appliedCount++;
  }

  if (appliedCount === 0) {
    console.log(`Database at ${dbPath} is already up to date (${migrationDirs.length} migration(s) applied).`);
  }

  db.close();
}

main();
