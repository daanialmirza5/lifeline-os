// Runs once, in its own process, before any test file. Recreates a clean
// test SQLite database from the same hand-applied migration used for
// local dev (see prisma/bootstrap.ts) — this only touches the filesystem,
// so it doesn't need to share env vars with the worker processes.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export default function globalSetup() {
  const dbPath = path.resolve(__dirname, "../prisma/test.db");
  const migrationPath = path.resolve(__dirname, "../prisma/migrations/0001_init/migration.sql");

  fs.rmSync(dbPath, { force: true });

  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  db.exec(fs.readFileSync(migrationPath, "utf-8"));
  db.close();
}
