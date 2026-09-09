// Local dev/test database bootstrap.
//
// Applies prisma/migrations/0001_init/migration.sql directly through the
// better-sqlite3 native addon (in-process, not a spawned executable).
// This exists because `prisma migrate dev` / `db push` spawn a native
// schema-engine binary, and on this machine that binary is blocked by a
// Windows Device Guard / WDAC policy. See docs/architecture.md for details.
// On any unrestricted machine, `npx prisma migrate dev` works normally and
// reads the same migrations/ directory.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import "dotenv/config";
import { resolveSqlitePath } from "../src/lib/sqlite-path";

function main() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const dbPath = resolveSqlitePath(url);
  const migrationPath = path.resolve(
    process.cwd(),
    "prisma/migrations/0001_init/migration.sql"
  );

  const freshDb = !fs.existsSync(dbPath);
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");

  if (freshDb) {
    const sql = fs.readFileSync(migrationPath, "utf-8");
    db.exec(sql);
    console.log(`Applied initial schema to ${dbPath}`);
  } else {
    console.log(`Database already exists at ${dbPath} — skipping schema apply.`);
    console.log("Delete the file (or run `npm run db:reset`) to re-bootstrap from scratch.");
  }

  db.close();
}

main();
