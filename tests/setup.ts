// Per-test-file setup: point the app at the test database created by
// tests/global-setup.ts. Must run before any test file imports
// src/lib/db.ts, since that module reads DATABASE_URL at import time.
process.env.DATABASE_URL = "file:./test.db";
process.env.AUTH_SECRET = "test-secret-not-for-production";
process.env.AI_PROVIDER = "mock";
