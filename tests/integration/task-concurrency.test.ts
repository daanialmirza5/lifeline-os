import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/lib/db";
import { hashPassword, authenticate } from "@/lib/auth";
import { createPatient } from "@/lib/services/patients";
import { createJourney } from "@/lib/services/journeys";
import { updateTaskStatus } from "@/lib/services/tasks";
import { ConflictError, UnauthorizedError } from "@/domain/errors";
import type { Session } from "@/lib/auth";

describe("integration: task optimistic concurrency", () => {
  let actor: Session;
  let patientId: string;
  let journeyId: string;

  beforeAll(async () => {
    const user = await db.user.create({
      data: {
        email: `concurrency-${crypto.randomUUID()}@test.local`,
        name: "Concurrency Tester",
        role: "CLINICIAN",
        passwordHash: await hashPassword("irrelevant"),
      },
    });
    actor = { userId: user.id, email: user.email, name: user.name, role: "CLINICIAN" };

    const patient = await createPatient({ name: "Concurrency Patient", dob: new Date("2000-01-01") });
    const journey = await createJourney(patient.id, "Concurrency Pathway");
    patientId = patient.id;
    journeyId = journey.id;
  });

  it("applies a status update when the version matches", async () => {
    const task = await db.task.create({
      data: { patientId, journeyId, title: "Version match", priority: "LOW", status: "OPEN" },
    });
    const updated = await updateTaskStatus(task.id, "IN_PROGRESS", task.version, actor);
    expect(updated.status).toBe("IN_PROGRESS");
    expect(updated.version).toBe(task.version + 1);
  });

  it("rejects a status update against a stale version", async () => {
    const task = await db.task.create({
      data: { patientId, journeyId, title: "Version stale", priority: "LOW", status: "OPEN" },
    });
    // Someone else updates it first, advancing the version.
    await updateTaskStatus(task.id, "IN_PROGRESS", task.version, actor);

    // Caller still holds the original (now stale) version.
    await expect(updateTaskStatus(task.id, "COMPLETED", task.version, actor)).rejects.toThrow(ConflictError);
  });

  it("completing a task with a linked obligation also completes the obligation", async () => {
    const event = await db.careEvent.create({
      data: {
        patientId,
        journeyId,
        type: "CONSULTATION",
        status: "COMPLETED",
        title: "Consult",
        occurredAt: new Date(),
      },
    });
    const obligation = await db.careObligation.create({
      data: {
        patientId,
        journeyId,
        sourceEventId: event.id,
        type: "TEST_OBLIGATION",
        description: "Test obligation",
        priority: "MEDIUM",
        status: "OPEN",
        dueAt: new Date(),
      },
    });
    const task = await db.task.create({
      data: {
        patientId,
        journeyId,
        obligationId: obligation.id,
        title: "Linked task",
        priority: "MEDIUM",
        status: "OPEN",
      },
    });

    await updateTaskStatus(task.id, "COMPLETED", task.version, actor);

    const finalObligation = await db.careObligation.findUniqueOrThrow({ where: { id: obligation.id } });
    expect(finalObligation.status).toBe("COMPLETED");
    expect(finalObligation.completedAt).not.toBeNull();
  });
});

describe("integration: authentication", () => {
  it("authenticates a user with correct credentials", async () => {
    const email = `auth-${crypto.randomUUID()}@test.local`;
    await db.user.create({
      data: { email, name: "Auth Test", role: "ADMIN", passwordHash: await hashPassword("correct-horse-battery") },
    });
    const session = await authenticate(email, "correct-horse-battery");
    expect(session.email).toBe(email);
    expect(session.role).toBe("ADMIN");
  });

  it("rejects an incorrect password", async () => {
    const email = `auth-${crypto.randomUUID()}@test.local`;
    await db.user.create({
      data: { email, name: "Auth Test", role: "ADMIN", passwordHash: await hashPassword("correct-horse-battery") },
    });
    await expect(authenticate(email, "wrong-password")).rejects.toThrow(UnauthorizedError);
  });

  it("rejects an unknown email without revealing whether the account exists", async () => {
    await expect(authenticate("nobody@test.local", "anything")).rejects.toThrow(UnauthorizedError);
  });
});
