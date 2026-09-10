import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { createPatient } from "@/lib/services/patients";
import { createJourney } from "@/lib/services/journeys";
import { createReferral } from "@/lib/services/referrals";
import { computeAndPersistRisk } from "@/lib/services/risk";
import { generateCoordinationRecommendations, decideRecommendation } from "@/lib/services/recommendations";
import type { Session } from "@/lib/auth";

/**
 * End-to-end domain pipeline (spec section 30 "Integration tests"):
 * Patient created -> Care event created -> Obligation generated ->
 * Risk recalculated -> AI recommendation created -> Clinician approves ->
 * Task created -> Audit event recorded.
 */
describe("integration: patient -> event -> obligation -> risk -> recommendation -> approval -> task -> audit", () => {
  let clinician: Session;

  beforeAll(async () => {
    const user = await db.user.create({
      data: {
        email: `clinician-${crypto.randomUUID()}@test.local`,
        name: "Test Clinician",
        role: "CLINICIAN",
        passwordHash: await hashPassword("irrelevant"),
      },
    });
    clinician = { userId: user.id, email: user.email, name: user.name, role: "CLINICIAN" };
  });

  it("runs the full pipeline and produces a consistent, auditable trail", async () => {
    // 1. Patient created
    const patient = await createPatient({ name: "Integration Test Patient", dob: new Date("1980-01-01") }, clinician);
    const journey = await createJourney(patient.id, "Test Pathway");
    expect(journey.state).toBe("CREATED");

    // 2. Care event created (referral), which derives an obligation
    const referral = await createReferral(
      { patientId: patient.id, journeyId: journey.id, specialty: "Cardiology" },
      clinician
    );
    expect(referral.status).toBe("PENDING");

    const obligations = await db.careObligation.findMany({ where: { journeyId: journey.id } });
    expect(obligations).toHaveLength(1);
    expect(obligations[0].type).toBe("SCHEDULE_SPECIALIST_APPOINTMENT");
    expect(obligations[0].status).toBe("OPEN");

    // Backdate the obligation so it's overdue, and the referral so it
    // counts as "unscheduled" by the risk engine's threshold.
    const pastDue = new Date();
    pastDue.setDate(pastDue.getDate() - 1);
    await db.careObligation.update({ where: { id: obligations[0].id }, data: { dueAt: pastDue, priority: "HIGH" } });
    const pastCreated = new Date();
    pastCreated.setDate(pastCreated.getDate() - 5);
    await db.referral.update({ where: { id: referral.id }, data: { createdAt: pastCreated } });

    // 3. Risk recalculated
    const risk = await computeAndPersistRisk(patient.id, journey.id);
    expect(risk.riskScore).toBeGreaterThan(0);
    expect(risk.factors.length).toBeGreaterThan(0);

    // 4. AI recommendation created
    const recommendations = await generateCoordinationRecommendations(patient.id, journey.id, clinician);
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0].status).toBe("SUGGESTED");

    // 5. Clinician approves
    const decided = await decideRecommendation(recommendations[0].id, "APPROVED", clinician);
    expect(decided.status).toBe("EXECUTED"); // approved COORDINATION recs auto-execute
    expect(decided.decidedById).toBe(clinician.userId);

    // 6. Task created
    const tasks = await db.task.findMany({ where: { journeyId: journey.id } });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe("OPEN");
    expect(tasks[0].assignedRole).toBe("COORDINATOR");

    // 7. Audit event recorded for every consequential step
    const audit = await db.auditEvent.findMany({
      where: { entityId: { in: [obligations[0].id, recommendations[0].id] } },
      orderBy: { createdAt: "asc" },
    });
    const actions = audit.map((a) => a.action);
    expect(actions).toContain("CREATE_OBLIGATION");
    expect(actions).toContain("RECOMMENDATION_APPROVED");
    expect(actions).toContain("RECOMMENDATION_EXECUTED");
  });

  it("rejects deciding the same recommendation twice", async () => {
    const patient = await createPatient({ name: "Double Decision Patient", dob: new Date("1975-05-05") }, clinician);
    const journey = await createJourney(patient.id, "Test Pathway");
    const referral = await createReferral(
      { patientId: patient.id, journeyId: journey.id, specialty: "Neurology" },
      clinician
    );
    const obligation = await db.careObligation.findFirstOrThrow({ where: { journeyId: journey.id } });
    await db.careObligation.update({
      where: { id: obligation.id },
      data: { dueAt: new Date(Date.now() - 86400000), priority: "HIGH" },
    });
    await db.referral.update({
      where: { id: referral.id },
      data: { createdAt: new Date(Date.now() - 5 * 86400000) },
    });
    await computeAndPersistRisk(patient.id, journey.id);
    const [rec] = await generateCoordinationRecommendations(patient.id, journey.id, clinician);

    await decideRecommendation(rec.id, "APPROVED", clinician);
    await expect(decideRecommendation(rec.id, "APPROVED", clinician)).rejects.toThrow(/already been decided/);
  });
});
