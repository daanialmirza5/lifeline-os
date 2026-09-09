import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { createPatient } from "@/lib/services/patients";
import { createJourney } from "@/lib/services/journeys";
import { applySyncOperation } from "@/lib/services/sync";
import type { Session } from "@/lib/auth";

describe("integration: offline sync idempotency and conflict detection", () => {
  let coordinator: Session;
  let patientId: string;
  let journeyId: string;

  beforeAll(async () => {
    const user = await db.user.create({
      data: {
        email: `coordinator-${crypto.randomUUID()}@test.local`,
        name: "Test Coordinator",
        role: "COORDINATOR",
        passwordHash: await hashPassword("irrelevant"),
      },
    });
    coordinator = { userId: user.id, email: user.email, name: user.name, role: "COORDINATOR" };

    const patient = await createPatient({ name: "Sync Test Patient", dob: new Date("1990-01-01") });
    const journey = await createJourney(patient.id, "Sync Test Pathway");
    patientId = patient.id;
    journeyId = journey.id;
  });

  it("applies an operation exactly once even when retried with the same operationId", async () => {
    const task = await db.task.create({
      data: { patientId, journeyId, title: "Idempotency test task", priority: "MEDIUM", status: "OPEN" },
    });
    const operationId = crypto.randomUUID();

    const first = await applySyncOperation(
      {
        operationId,
        entityType: "Task",
        entityId: task.id,
        operationType: "ACKNOWLEDGE",
        payload: {},
        baseVersion: task.version,
      },
      coordinator
    );
    expect(first.syncStatus).toBe("APPLIED");

    // Retry with the identical operationId (simulating a dropped response
    // and client retry) must not re-apply the mutation.
    const retry = await applySyncOperation(
      {
        operationId,
        entityType: "Task",
        entityId: task.id,
        operationType: "ACKNOWLEDGE",
        payload: {},
        baseVersion: task.version,
      },
      coordinator
    );
    expect(retry.syncStatus).toBe("APPLIED");

    const finalTask = await db.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(finalTask.status).toBe("IN_PROGRESS");
    expect(finalTask.version).toBe(2); // incremented exactly once, not twice

    const opRecords = await db.syncOperation.findMany({ where: { operationId } });
    expect(opRecords).toHaveLength(1); // no duplicate operation row either
  });

  it("detects a conflict when the queued baseVersion is stale", async () => {
    const task = await db.task.create({
      data: { patientId, journeyId, title: "Conflict test task", priority: "MEDIUM", status: "OPEN" },
    });

    // Server-side update advances the version (simulating an online
    // clinician action that happened while the coordinator was offline).
    await db.task.update({ where: { id: task.id }, data: { status: "COMPLETED", version: { increment: 1 } } });

    const result = await applySyncOperation(
      {
        operationId: crypto.randomUUID(),
        entityType: "Task",
        entityId: task.id,
        operationType: "UPDATE_STATUS",
        payload: { status: "CANCELLED" },
        baseVersion: task.version, // stale — server has already moved past this
      },
      coordinator
    );

    expect(result.syncStatus).toBe("CONFLICT");
    expect(result.conflict).toBeDefined();

    // The server value must not have been overwritten by the conflicting
    // local update.
    const finalTask = await db.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(finalTask.status).toBe("COMPLETED");
  });

  it("never duplicates a sync operation record across two distinct operationIds for the same logical action", async () => {
    const task = await db.task.create({
      data: { patientId, journeyId, title: "Distinct ops task", priority: "LOW", status: "OPEN" },
    });

    const opA = crypto.randomUUID();
    const opB = crypto.randomUUID();

    await applySyncOperation(
      { operationId: opA, entityType: "Task", entityId: task.id, operationType: "ACKNOWLEDGE", payload: {}, baseVersion: task.version },
      coordinator
    );

    // A genuinely different operationId for the same entity is a distinct
    // action (not a retry) and is recorded separately, even though it now
    // conflicts because the version has moved on.
    const result = await applySyncOperation(
      { operationId: opB, entityType: "Task", entityId: task.id, operationType: "ACKNOWLEDGE", payload: {}, baseVersion: task.version },
      coordinator
    );
    expect(result.syncStatus).toBe("CONFLICT");

    const records = await db.syncOperation.findMany({ where: { entityId: task.id } });
    expect(records.map((r) => r.operationId).sort()).toEqual([opA, opB].sort());
  });
});
