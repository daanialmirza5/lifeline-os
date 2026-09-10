import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { createPatient } from "@/lib/services/patients";
import { createJourney, transitionJourney } from "@/lib/services/journeys";
import { createReferral } from "@/lib/services/referrals";
import type { Session } from "@/lib/auth";

/**
 * Terminal journey / obligation consistency. A COMPLETED or CANCELLED
 * journey with obligations still OPEN/IN_PROGRESS/OVERDUE is an
 * inconsistent state -- those obligations would keep counting toward
 * continuity risk and keep appearing as actionable work for a care
 * pathway that's already closed. transitionJourney now auto-cancels them
 * on reaching a terminal state (src/lib/services/journeys.ts).
 */
describe("integration: obligation consistency on terminal journey states", () => {
  let actor: Session;

  beforeAll(async () => {
    const user = await db.user.create({
      data: {
        email: `terminal-journey-${crypto.randomUUID()}@test.local`,
        name: "Terminal Journey Tester",
        role: "CLINICIAN",
        passwordHash: await hashPassword("irrelevant"),
      },
    });
    actor = { userId: user.id, email: user.email, name: user.name, role: "CLINICIAN" };
  });

  it("cancels dangling open obligations when a journey is cancelled", async () => {
    const patient = await createPatient({ name: "Terminal State Patient", dob: new Date("1991-04-04") }, actor);
    const journey = await createJourney(patient.id, "Terminal Test Pathway");
    await transitionJourney(journey.id, "ACTIVE", actor);

    // Creating a referral derives an OPEN "schedule specialist
    // appointment" obligation (src/domain/obligations.ts) that nobody
    // ever resolves before the journey is cancelled.
    await createReferral({ patientId: patient.id, journeyId: journey.id, specialty: "Neurology" }, actor);
    const obligationsBefore = await db.careObligation.findMany({ where: { journeyId: journey.id } });
    expect(obligationsBefore).toHaveLength(1);
    expect(obligationsBefore[0].status).toBe("OPEN");

    await transitionJourney(journey.id, "CANCELLED", actor);

    const obligationsAfter = await db.careObligation.findMany({ where: { journeyId: journey.id } });
    expect(obligationsAfter).toHaveLength(1);
    expect(obligationsAfter[0].status).toBe("CANCELLED");

    // The cancellation itself is audited, distinct from the journey
    // transition's own audit entry.
    const audit = await db.auditEvent.findMany({ where: { entityId: obligationsAfter[0].id, action: "CANCEL_OBLIGATION" } });
    expect(audit).toHaveLength(1);
    expect(audit[0].reason).toContain("CANCELLED");
  });

  it("cancels dangling overdue obligations when a journey completes, and does not touch already-resolved ones", async () => {
    const patient = await createPatient({ name: "Terminal State Patient 2", dob: new Date("1992-05-05") }, actor);
    const journey = await createJourney(patient.id, "Terminal Test Pathway 2");
    await transitionJourney(journey.id, "ACTIVE", actor);

    await createReferral({ patientId: patient.id, journeyId: journey.id, specialty: "Dermatology" }, actor);
    const [obligation] = await db.careObligation.findMany({ where: { journeyId: journey.id } });

    // One obligation overdue and unresolved, one already completed --
    // only the unresolved one should be touched.
    await db.careObligation.update({ where: { id: obligation.id }, data: { status: "OVERDUE" } });
    const resolvedEvent = await db.careEvent.findFirstOrThrow({ where: { journeyId: journey.id } });
    const alreadyCompleted = await db.careObligation.create({
      data: {
        patientId: patient.id,
        journeyId: journey.id,
        sourceEventId: resolvedEvent.id,
        type: "ALREADY_DONE",
        description: "Already resolved before journey closed",
        priority: "LOW",
        status: "COMPLETED",
        dueAt: new Date(),
        completedAt: new Date(),
      },
    });

    await transitionJourney(journey.id, "ACTION_REQUIRED", actor);
    await transitionJourney(journey.id, "IN_PROGRESS", actor);
    await transitionJourney(journey.id, "COMPLETED", actor);

    const finalObligation = await db.careObligation.findUniqueOrThrow({ where: { id: obligation.id } });
    expect(finalObligation.status).toBe("CANCELLED");

    const untouchedObligation = await db.careObligation.findUniqueOrThrow({ where: { id: alreadyCompleted.id } });
    expect(untouchedObligation.status).toBe("COMPLETED"); // unchanged, not re-cancelled
  });

  it("does not touch obligations when transitioning between two non-terminal states", async () => {
    const patient = await createPatient({ name: "Non Terminal Patient", dob: new Date("1993-06-06") }, actor);
    const journey = await createJourney(patient.id, "Non Terminal Pathway");
    await transitionJourney(journey.id, "ACTIVE", actor);
    await createReferral({ patientId: patient.id, journeyId: journey.id, specialty: "Orthopedics" }, actor);

    await transitionJourney(journey.id, "BLOCKED", actor);

    const obligations = await db.careObligation.findMany({ where: { journeyId: journey.id } });
    expect(obligations[0].status).toBe("OPEN"); // still open -- BLOCKED is not terminal
  });
});
