import { db } from "@/lib/db";
import { Session } from "@/lib/auth";
import { updateTaskStatus } from "./tasks";
import { ConflictError, ValidationError } from "@/domain/errors";
import { TaskStatus } from "@/domain/types";

export interface SyncOperationInput {
  operationId: string;
  entityType: "Task" | "CareObligation" | "Document";
  entityId: string;
  operationType: "ACKNOWLEDGE" | "UPDATE_STATUS" | "ADD_NOTE";
  payload: Record<string, unknown>;
  baseVersion?: number;
}

export interface SyncApplyResult {
  operationId: string;
  syncStatus: "APPLIED" | "CONFLICT" | "REJECTED";
  conflict?: { local: unknown; server: unknown };
}

/**
 * Applies one queued offline operation. Idempotent on `operationId`: if
 * this exact operation was already recorded (e.g. a retried request after
 * a dropped response), the stored outcome is returned unchanged instead
 * of being re-applied — this is what prevents a retry from double-firing
 * a mutation (spec section 19/20).
 */
export async function applySyncOperation(
  input: SyncOperationInput,
  actor: Session
): Promise<SyncApplyResult> {
  const existing = await db.syncOperation.findUnique({ where: { operationId: input.operationId } });
  if (existing) {
    return {
      operationId: input.operationId,
      syncStatus: existing.syncStatus as SyncApplyResult["syncStatus"],
      conflict: existing.conflictDetails ? JSON.parse(existing.conflictDetails) : undefined,
    };
  }

  const record = await db.syncOperation.create({
    data: {
      operationId: input.operationId,
      userId: actor.userId,
      entityType: input.entityType,
      entityId: input.entityId,
      operationType: input.operationType,
      payload: JSON.stringify(input.payload),
      syncStatus: "PENDING",
    },
  });

  try {
    const result = await applyToEntity(input, actor);

    await db.syncOperation.update({
      where: { id: record.id },
      data: { syncStatus: result.syncStatus, appliedAt: new Date(), conflictDetails: result.conflict ? JSON.stringify(result.conflict) : null },
    });

    return { operationId: input.operationId, ...result };
  } catch (err) {
    await db.syncOperation.update({
      where: { id: record.id },
      data: { syncStatus: "REJECTED" },
    });
    if (err instanceof ConflictError || err instanceof ValidationError) {
      return { operationId: input.operationId, syncStatus: "REJECTED" };
    }
    throw err;
  }
}

async function applyToEntity(
  input: SyncOperationInput,
  actor: Session
): Promise<{ syncStatus: SyncApplyResult["syncStatus"]; conflict?: { local: unknown; server: unknown } }> {
  if (input.entityType !== "Task") {
    throw new ValidationError(`Sync for entity type ${input.entityType} is not yet supported.`);
  }

  const server = await db.task.findUnique({ where: { id: input.entityId } });
  if (!server) throw new ValidationError(`Task ${input.entityId} not found.`);

  if (input.operationType === "ACKNOWLEDGE") {
    if (server.status !== "OPEN") {
      return { syncStatus: "CONFLICT", conflict: { local: "ACKNOWLEDGE (expects OPEN)", server: server.status } };
    }
    await updateTaskStatus(input.entityId, "IN_PROGRESS", server.version, actor);
    return { syncStatus: "APPLIED" };
  }

  if (input.operationType === "UPDATE_STATUS") {
    const targetStatus = input.payload.status as TaskStatus | undefined;
    if (!targetStatus) throw new ValidationError("payload.status is required for UPDATE_STATUS");

    // baseVersion is required here, not merely checked when present: it's
    // the entire conflict-detection mechanism for this operation type.
    // Falling back to `server.version` when it's missing (the previous
    // behavior) meant the very value the "conflict?" check compares
    // against was read from the same live row the check is supposed to
    // guard — trivially matching itself, silently applying the update no
    // matter how stale the client's actual view of the task was. Treating
    // a missing baseVersion as a validation error keeps the comparison
    // meaningful for every UPDATE_STATUS operation, not just the ones a
    // well-behaved client happens to include it on.
    if (input.baseVersion === undefined) {
      throw new ValidationError("baseVersion is required for UPDATE_STATUS.");
    }

    if (input.baseVersion !== server.version) {
      return {
        syncStatus: "CONFLICT",
        conflict: { local: { status: targetStatus, baseVersion: input.baseVersion }, server: { status: server.status, version: server.version } },
      };
    }

    try {
      await updateTaskStatus(input.entityId, targetStatus, input.baseVersion, actor);
      return { syncStatus: "APPLIED" };
    } catch (err) {
      if (err instanceof ConflictError) {
        return {
          syncStatus: "CONFLICT",
          conflict: { local: { status: targetStatus }, server: { status: server.status, version: server.version } },
        };
      }
      throw err;
    }
  }

  throw new ValidationError(`Unsupported operationType ${input.operationType} for Task.`);
}

export async function resolveConflict(
  operationId: string,
  resolution: "KEEP_SERVER" | "APPLY_LOCAL",
  actor: Session
) {
  const op = await db.syncOperation.findUnique({ where: { operationId } });
  if (!op || op.syncStatus !== "CONFLICT") {
    throw new ValidationError(`No open conflict for operation ${operationId}.`);
  }

  if (resolution === "APPLY_LOCAL") {
    const payload = JSON.parse(op.payload) as { status?: TaskStatus };
    const server = await db.task.findUniqueOrThrow({ where: { id: op.entityId } });
    if (payload.status) {
      await updateTaskStatus(op.entityId, payload.status, server.version, actor);
    }
  }

  return db.syncOperation.update({
    where: { operationId },
    data: { syncStatus: "APPLIED", appliedAt: new Date() },
  });
}
