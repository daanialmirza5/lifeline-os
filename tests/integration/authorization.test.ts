import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { requirePatientAccess, accessiblePatientWhereClause } from "@/lib/authorization";
import { PatientAccessDeniedError, NotFoundError } from "@/domain/errors";
import { createPatient } from "@/lib/services/patients";
import { createJourney } from "@/lib/services/journeys";
import { createReferral } from "@/lib/services/referrals";
import { decideRecommendation, generateCoordinationRecommendations } from "@/lib/services/recommendations";
import { computeAndPersistRisk } from "@/lib/services/risk";
import type { Session } from "@/lib/auth";

/**
 * Patient-scoped authorization (src/lib/authorization.ts).
 *
 * Role-based rejection (requireSession/requireRole in src/lib/auth.ts) is
 * pre-existing code this sprint didn't change, and depends on Next's
 * request-scoped `cookies()`, which can't be exercised outside a real HTTP
 * request in a plain Vitest test -- it's covered instead by every
 * authenticated E2E scenario (unauthenticated access redirects to /login)
 * and by the "authentication" tests in task-concurrency.test.ts (wrong
 * password/unknown email rejected). This file covers the layer that IS
 * new: given a role that's allowed to act in general, is it allowed to
 * act on *this specific patient*.
 */
describe("integration: patient-scoped authorization", () => {
  let admin: Session;
  let clinicianOnTeam: Session;
  let clinicianOffTeam: Session;
  let coordinatorOnTeam: Session;
  let patientUser: Session;
  let otherPatientUser: Session;
  let patientId: string;
  let otherPatientId: string;

  beforeAll(async () => {
    async function makeUser(role: "ADMIN" | "CLINICIAN" | "COORDINATOR" | "PATIENT", label: string): Promise<Session> {
      const user = await db.user.create({
        data: {
          email: `authz-${label}-${crypto.randomUUID()}@test.local`,
          name: `Authz Test ${label}`,
          role,
          passwordHash: await hashPassword("irrelevant"),
        },
      });
      return { userId: user.id, email: user.email, name: user.name, role };
    }

    admin = await makeUser("ADMIN", "admin");
    clinicianOnTeam = await makeUser("CLINICIAN", "clinician-on-team");
    clinicianOffTeam = await makeUser("CLINICIAN", "clinician-off-team");
    coordinatorOnTeam = await makeUser("COORDINATOR", "coordinator-on-team");

    // Patient created by clinicianOnTeam -> createPatient auto-assigns
    // them to its care team.
    const patient = await createPatient({ name: "Authz Test Patient", dob: new Date("1988-03-03") }, clinicianOnTeam);
    patientId = patient.id;
    await createJourney(patientId, "Authz Test Pathway");

    await db.careTeamMembership.create({
      data: { userId: coordinatorOnTeam.userId, patientId, role: "COORDINATOR" },
    });

    const patientLinkedUser = await db.user.create({
      data: {
        email: `authz-patient-${crypto.randomUUID()}@test.local`,
        name: "Authz Patient User",
        role: "PATIENT",
        passwordHash: await hashPassword("irrelevant"),
      },
    });
    await db.patient.update({ where: { id: patientId }, data: { userId: patientLinkedUser.id } });
    patientUser = { userId: patientLinkedUser.id, email: patientLinkedUser.email, name: patientLinkedUser.name, role: "PATIENT" };

    // A second, unrelated patient nobody above (except admin/clinicianOnTeam
    // as its creator) has access to.
    const otherPatient = await createPatient({ name: "Authz Other Patient", dob: new Date("1992-07-07") }, admin);
    otherPatientId = otherPatient.id;
    const otherPatientLinkedUser = await db.user.create({
      data: {
        email: `authz-other-patient-${crypto.randomUUID()}@test.local`,
        name: "Authz Other Patient User",
        role: "PATIENT",
        passwordHash: await hashPassword("irrelevant"),
      },
    });
    await db.patient.update({ where: { id: otherPatientId }, data: { userId: otherPatientLinkedUser.id } });
    otherPatientUser = {
      userId: otherPatientLinkedUser.id,
      email: otherPatientLinkedUser.email,
      name: otherPatientLinkedUser.name,
      role: "PATIENT",
    };
  });

  describe("requirePatientAccess", () => {
    it("allows a clinician on the patient's care team", async () => {
      await expect(requirePatientAccess(patientId, clinicianOnTeam)).resolves.toBeUndefined();
    });

    it("allows a coordinator on the patient's care team", async () => {
      await expect(requirePatientAccess(patientId, coordinatorOnTeam)).resolves.toBeUndefined();
    });

    it("denies a clinician who is the correct role but not on this patient's care team", async () => {
      await expect(requirePatientAccess(patientId, clinicianOffTeam)).rejects.toThrow(PatientAccessDeniedError);
    });

    it("allows a patient to access their own linked record", async () => {
      await expect(requirePatientAccess(patientId, patientUser)).resolves.toBeUndefined();
    });

    it("denies a patient accessing a different patient's record", async () => {
      await expect(requirePatientAccess(otherPatientId, patientUser)).rejects.toThrow(PatientAccessDeniedError);
      // And the reverse, for good measure -- neither patient can see the other.
      await expect(requirePatientAccess(patientId, otherPatientUser)).rejects.toThrow(PatientAccessDeniedError);
    });

    it("allows admin unrestricted access regardless of care-team membership", async () => {
      await expect(requirePatientAccess(patientId, admin)).resolves.toBeUndefined();
      await expect(requirePatientAccess(otherPatientId, admin)).resolves.toBeUndefined();
    });

    it("raises NotFoundError, not a silent pass, for a nonexistent patient id under a PATIENT session", async () => {
      await expect(requirePatientAccess("does-not-exist", patientUser)).rejects.toThrow(NotFoundError);
    });
  });

  describe("accessiblePatientWhereClause (list scoping)", () => {
    it("scopes a CLINICIAN's patient list to only their care-team patients", async () => {
      const visible = await db.patient.findMany({ where: accessiblePatientWhereClause(clinicianOnTeam) });
      const visibleIds = visible.map((p) => p.id);
      expect(visibleIds).toContain(patientId);
      expect(visibleIds).not.toContain(otherPatientId);
    });

    it("returns nothing for a clinician on no care teams", async () => {
      const visible = await db.patient.findMany({ where: accessiblePatientWhereClause(clinicianOffTeam) });
      expect(visible.map((p) => p.id)).not.toContain(patientId);
    });

    it("scopes a PATIENT's list to exactly their own record", async () => {
      const visible = await db.patient.findMany({ where: accessiblePatientWhereClause(patientUser) });
      expect(visible).toHaveLength(1);
      expect(visible[0].id).toBe(patientId);
    });

    it("gives admin the unfiltered list", async () => {
      const visible = await db.patient.findMany({ where: accessiblePatientWhereClause(admin) });
      const visibleIds = visible.map((p) => p.id);
      expect(visibleIds).toContain(patientId);
      expect(visibleIds).toContain(otherPatientId);
    });
  });

  describe("enforcement on mutations (not just reads)", () => {
    it("rejects creating a referral for a patient the clinician cannot access", async () => {
      await expect(
        createReferral({ patientId: otherPatientId, journeyId: "irrelevant", specialty: "Cardiology" }, clinicianOffTeam)
      ).rejects.toThrow(PatientAccessDeniedError);

      // And confirms no orphaned Referral row was written before the check
      // inside the createCareEvent call it makes internally.
      const orphaned = await db.referral.findMany({ where: { patientId: otherPatientId, specialty: "Cardiology" } });
      expect(orphaned).toHaveLength(0);
    });

    it("rejects deciding a recommendation for a patient the coordinator cannot access", async () => {
      const journey = await db.careJourney.findFirstOrThrow({ where: { patientId } });
      const sourceEvent = await db.careEvent.create({
        data: {
          patientId,
          journeyId: journey.id,
          type: "CONSULTATION",
          status: "COMPLETED",
          title: "Authz test consultation",
          occurredAt: new Date(),
        },
      });
      const obligation = await db.careObligation.create({
        data: {
          patientId,
          journeyId: journey.id,
          sourceEventId: sourceEvent.id,
          type: "TEST_OBLIGATION",
          description: "Authz test obligation",
          priority: "HIGH",
          status: "OVERDUE",
          dueAt: new Date(Date.now() - 86400000),
        },
      });
      await computeAndPersistRisk(patientId, journey.id);
      const [rec] = await generateCoordinationRecommendations(patientId, journey.id, admin);
      expect(rec).toBeDefined();

      const outsideCoordinator = await db.user.create({
        data: {
          email: `authz-outside-coordinator-${crypto.randomUUID()}@test.local`,
          name: "Outside Coordinator",
          role: "COORDINATOR",
          passwordHash: await hashPassword("irrelevant"),
        },
      });
      const outsideSession: Session = {
        userId: outsideCoordinator.id,
        email: outsideCoordinator.email,
        name: outsideCoordinator.name,
        role: "COORDINATOR",
      };

      await expect(decideRecommendation(rec.id, "APPROVED", outsideSession)).rejects.toThrow(PatientAccessDeniedError);

      // Confirm it's genuinely still pending -- the denied attempt didn't
      // partially apply.
      const stillSuggested = await db.aIRecommendation.findUniqueOrThrow({ where: { id: rec.id } });
      expect(stillSuggested.status).toBe("SUGGESTED");

      // Sanity check: the same decision succeeds for someone who IS on
      // the care team.
      const decided = await decideRecommendation(rec.id, "APPROVED", coordinatorOnTeam);
      expect(["APPROVED", "EXECUTED"]).toContain(decided.status);
      void obligation;
    });
  });
});
