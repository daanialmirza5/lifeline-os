import { db } from "@/lib/db";
import { recordAudit, newRequestId } from "@/lib/audit";
import { ConflictError, NotFoundError } from "@/domain/errors";
import { Session } from "@/lib/auth";
import { Priority, Role, TaskStatus } from "@/domain/types";
import { requirePatientAccess } from "@/lib/authorization";

export interface CreateTaskInput {
  patientId: string;
  journeyId: string;
  obligationId?: string;
  title: string;
  description?: string;
  assignedToId?: string;
  assignedRole?: Role;
  priority?: Priority;
  dueAt?: Date;
}

export async function createTask(input: CreateTaskInput, actor: Session) {
  await requirePatientAccess(input.patientId, actor);

  const task = await db.task.create({
    data: {
      patientId: input.patientId,
      journeyId: input.journeyId,
      obligationId: input.obligationId ?? null,
      title: input.title,
      description: input.description ?? null,
      assignedToId: input.assignedToId ?? null,
      assignedRole: input.assignedRole ?? null,
      priority: input.priority ?? "MEDIUM",
      status: "OPEN",
      dueAt: input.dueAt ?? null,
    },
  });

  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: "CREATE_TASK",
    entityType: "Task",
    entityId: task.id,
    newState: "OPEN",
    requestId: newRequestId(),
  });

  return task;
}

/**
 * Optimistic-concurrency status update. Requires the caller's last-known
 * `expectedVersion` to still match the stored version — this is the same
 * mechanism the offline sync path uses to detect conflicting concurrent
 * edits (spec section 20), just invoked synchronously here for the
 * online case.
 */
export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  expectedVersion: number,
  actor: Session
) {
  const existing = await db.task.findUnique({ where: { id: taskId } });
  if (!existing) throw new NotFoundError("Task", taskId);
  await requirePatientAccess(existing.patientId, actor);

  const { count } = await db.task.updateMany({
    where: { id: taskId, version: expectedVersion },
    data: {
      status,
      version: { increment: 1 },
      completedAt: status === "COMPLETED" ? new Date() : null,
    },
  });

  if (count === 0) {
    throw new ConflictError(
      `Task ${taskId} was modified by someone else (expected version ${expectedVersion}, current version ${existing.version}). Refresh and retry.`
    );
  }

  const updated = await db.task.findUniqueOrThrow({ where: { id: taskId } });

  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: "UPDATE_TASK_STATUS",
    entityType: "Task",
    entityId: taskId,
    previousState: existing.status,
    newState: status,
    requestId: newRequestId(),
  });

  if (status === "COMPLETED" && updated.obligationId) {
    await db.careObligation.update({
      where: { id: updated.obligationId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    await recordAudit({
      actorId: actor.userId,
      actorRole: actor.role,
      action: "COMPLETE_OBLIGATION",
      entityType: "CareObligation",
      entityId: updated.obligationId,
      newState: "COMPLETED",
      reason: `Fulfilled by task ${taskId}`,
      requestId: newRequestId(),
    });
  }

  return updated;
}

/**
 * NOT patient-scoped: shows every open task regardless of the caller's
 * care-team memberships. Acting on a specific task (updateTaskStatus,
 * above) IS enforced — this only affects what appears in the list. Scoping
 * this list is a reasonable next step (see docs/security.md) but was left
 * out of this pass to avoid touching the Tasks page's tested behavior for
 * coordinators who legitimately need cross-patient visibility of the
 * work queue; tracked as a known limitation rather than silently assumed.
 */
export async function listTasks(filter?: { status?: TaskStatus; assignedToId?: string }) {
  return db.task.findMany({
    where: filter,
    include: { patient: true },
    orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
  });
}
