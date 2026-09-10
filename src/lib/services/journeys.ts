import { db } from "@/lib/db";
import { recordAudit, newRequestId } from "@/lib/audit";
import { validateJourneyTransition } from "@/domain/workflow";
import { isTerminalJourneyState, JourneyState } from "@/domain/types";
import { ConflictError, NotFoundError } from "@/domain/errors";
import { Session } from "@/lib/auth";
import { requirePatientAccess } from "@/lib/authorization";

export async function createJourney(patientId: string, title: string) {
  return db.careJourney.create({
    data: { patientId, title, state: "CREATED" },
  });
}

export async function getJourneyOrThrow(journeyId: string) {
  const journey = await db.careJourney.findUnique({ where: { id: journeyId } });
  if (!journey) throw new NotFoundError("CareJourney", journeyId);
  return journey;
}

export async function transitionJourney(
  journeyId: string,
  to: JourneyState,
  actor: Session,
  reason?: string
) {
  const journey = await getJourneyOrThrow(journeyId);
  await requirePatientAccess(journey.patientId, actor);
  const from = journey.state as JourneyState;

  // Throws InvalidTransitionError for terminal-state mutation, duplicate,
  // or out-of-order transitions — never silently coerced.
  validateJourneyTransition(from, to);

  // Compare-and-swap on the state itself (same pattern as
  // services/tasks.ts#updateTaskStatus, just using `state` as its own
  // version marker instead of a separate counter column): without the
  // `state: from` condition here, two concurrent transitions starting
  // from the same state could both pass validateJourneyTransition above
  // against the same stale `from`, and the second write would silently
  // clobber the first with no error and no trace beyond a misleading
  // audit log showing two "valid" transitions from a state the journey
  // was never actually in when the second one applied.
  const { count } = await db.careJourney.updateMany({
    where: { id: journeyId, state: from },
    data: { state: to },
  });

  if (count === 0) {
    throw new ConflictError(
      `Journey ${journeyId} was transitioned by someone else before this request completed (expected state ${from}). Refresh and retry.`
    );
  }

  const updated = await db.careJourney.findUniqueOrThrow({ where: { id: journeyId } });

  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: "TRANSITION_JOURNEY",
    entityType: "CareJourney",
    entityId: journeyId,
    previousState: from,
    newState: to,
    reason: reason ?? null,
    requestId: newRequestId(),
  });

  // A terminal journey (COMPLETED or CANCELLED) with obligations still
  // OPEN/IN_PROGRESS/OVERDUE is an inconsistent state: those obligations
  // would otherwise keep counting toward continuity risk and keep
  // appearing as actionable work for a care pathway that's already
  // closed. Auto-cancel them rather than leaving them dangling — CANCELLED
  // (not COMPLETED) because closing the journey doesn't mean the
  // obligation was actually fulfilled, just that it's moot now.
  if (isTerminalJourneyState(to)) {
    const dangling = await db.careObligation.findMany({
      where: { journeyId, status: { in: ["OPEN", "IN_PROGRESS", "OVERDUE"] } },
      select: { id: true, status: true },
    });
    for (const obligation of dangling) {
      await db.careObligation.update({ where: { id: obligation.id }, data: { status: "CANCELLED" } });
      await recordAudit({
        actorId: actor.userId,
        actorRole: actor.role,
        action: "CANCEL_OBLIGATION",
        entityType: "CareObligation",
        entityId: obligation.id,
        previousState: obligation.status,
        newState: "CANCELLED",
        reason: `Journey ${journeyId} moved to terminal state ${to}`,
        requestId: newRequestId(),
      });
    }
  }

  return updated;
}

export async function getJourneyWithGraph(journeyId: string) {
  const journey = await db.careJourney.findUnique({
    where: { id: journeyId },
    include: {
      events: { orderBy: { occurredAt: "asc" } },
      obligations: { orderBy: { dueAt: "asc" } },
      patient: true,
    },
  });
  if (!journey) throw new NotFoundError("CareJourney", journeyId);
  return journey;
}
