import { db } from "./db";

export interface AuditInput {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  previousState?: string | null;
  newState?: string | null;
  reason?: string | null;
  requestId: string;
  careEventId?: string | null;
}

/**
 * Appends one audit record. There is deliberately no update/delete
 * function in this module — the audit log is append-only at the
 * application layer (spec section 21).
 */
export async function recordAudit(input: AuditInput) {
  return db.auditEvent.create({
    data: {
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      previousState: input.previousState ?? null,
      newState: input.newState ?? null,
      reason: input.reason ?? null,
      requestId: input.requestId,
      careEventId: input.careEventId ?? null,
    },
  });
}

export function newRequestId(): string {
  return crypto.randomUUID();
}
