// Runs once, in its own process, before any test file. Recreates a clean
// test SQLite database by applying every migration under
// prisma/migrations/, in order (mirrors prisma/bootstrap.ts, which local
// dev uses the same way) — this only touches the filesystem, so it
// doesn't need to share env vars with the worker processes.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export default function globalSetup() {
  const dbPath = path.resolve(__dirname, "../prisma/test.db");
  const migrationsDir = path.resolve(__dirname, "../prisma/migrations");

  fs.rmSync(dbPath, { force: true });

  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");

  const migrationDirs = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const migrationName of migrationDirs) {
    const sqlPath = path.join(migrationsDir, migrationName, "migration.sql");
    if (!fs.existsSync(sqlPath)) continue;
    db.exec(fs.readFileSync(sqlPath, "utf-8"));
  }

  db.close();
}
