import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { createPatient } from "@/lib/services/patients";
import type { Session } from "@/lib/auth";

/**
 * Audit coverage for mutations that previously had none. Not a general
 * coverage sweep (every service already writes its own audit entries,
 * checked incidentally throughout the other integration tests) -- this
 * targets the one gap actually found: patient creation.
 */
describe("integration: audit coverage", () => {
  it("records a CREATE_PATIENT audit event, and notes the auto-assigned care team membership", async () => {
    const user = await db.user.create({
      data: {
        email: `audit-coverage-${crypto.randomUUID()}@test.local`,
        name: "Audit Coverage Tester",
        role: "CLINICIAN",
        passwordHash: await hashPassword("irrelevant"),
      },
    });
    const actor: Session = { userId: user.id, email: user.email, name: user.name, role: "CLINICIAN" };

    const patient = await createPatient({ name: "Audit Coverage Patient", dob: new Date("1994-08-08") }, actor);

    const audit = await db.auditEvent.findMany({ where: { entityType: "Patient", entityId: patient.id } });
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe("CREATE_PATIENT");
    expect(audit[0].actorId).toBe(actor.userId);
    expect(audit[0].reason).toContain("CLINICIAN");
  });
});
