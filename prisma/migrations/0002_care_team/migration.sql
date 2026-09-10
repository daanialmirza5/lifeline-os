-- Patient-scoped authorization: grants a CLINICIAN/COORDINATOR user access
-- to a specific patient. See src/lib/authorization.ts.
--
-- Hand-written for the same reason 0001_init/migration.sql is (see the
-- note at the top of that file and in prisma/bootstrap.ts) — the native
-- Prisma schema-engine binary is blocked on the machine this was built on.

CREATE TABLE "CareTeamMembership" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "patientId" TEXT NOT NULL REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "role" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL,
  UNIQUE ("userId", "patientId")
);
CREATE INDEX "CareTeamMembership_patientId_idx" ON "CareTeamMembership"("patientId");
CREATE INDEX "CareTeamMembership_userId_idx" ON "CareTeamMembership"("userId");
