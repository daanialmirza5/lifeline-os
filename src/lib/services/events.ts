import { db } from "@/lib/db";
import { recordAudit, newRequestId } from "@/lib/audit";
import { deriveObligationsForEvent } from "@/domain/obligations";
import { CareEventStatus, CareEventType } from "@/domain/types";
import { computeAndPersistRisk } from "./risk";
import { Session } from "@/lib/auth";

export interface CreateCareEventInput {
  patientId: string;
  journeyId: string;
  type: CareEventType;
  status?: CareEventStatus;
  title: string;
  description?: string;
  occurredAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * The core event-driven pipeline (spec section 37):
 * CareEventCreated -> ObligationEngine -> RiskEngine.
 * Recommendation generation is a separate, explicit step
 * (services/recommendations.ts) rather than automatic on every event, so
 * AI calls stay bounded and observable rather than firing on every write.
 */
export async function createCareEvent(input: CreateCareEventInput, actor: Session) {
  const event = await db.careEvent.create({
    data: {
      patientId: input.patientId,
      journeyId: input.journeyId,
      type: input.type,
      status: input.status ?? "COMPLETED",
      title: input.title,
      description: input.description ?? null,
      occurredAt: input.occurredAt ?? new Date(),
      createdById: actor.userId,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });

  const templates = deriveObligationsForEvent({ type: input.type, metadata: input.metadata });
  const obligations = [];
  for (const template of templates) {
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + template.dueInDays);
    const obligation = await db.careObligation.create({
      data: {
        patientId: input.patientId,
        journeyId: input.journeyId,
        sourceEventId: event.id,
        type: template.type,
        description: template.description,
        priority: template.priority,
        dueAt,
        status: "OPEN",
      },
    });
    obligations.push(obligation);

    await recordAudit({
      actorId: actor.userId,
      actorRole: actor.role,
      action: "CREATE_OBLIGATION",
      entityType: "CareObligation",
      entityId: obligation.id,
      newState: "OPEN",
      reason: `Derived from event ${event.id} (${input.type})`,
      requestId: newRequestId(),
    });
  }

  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: "CREATE_EVENT",
    entityType: "CareEvent",
    entityId: event.id,
    newState: event.status,
    requestId: newRequestId(),
    careEventId: event.id,
  });

  const risk = await computeAndPersistRisk(input.patientId, input.journeyId);

  return { event, obligations, risk };
}
