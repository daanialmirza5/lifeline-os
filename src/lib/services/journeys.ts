import { db } from "@/lib/db";
import { recordAudit, newRequestId } from "@/lib/audit";
import { validateJourneyTransition } from "@/domain/workflow";
import { JourneyState } from "@/domain/types";
import { NotFoundError } from "@/domain/errors";
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

  const updated = await db.careJourney.update({
    where: { id: journeyId },
    data: { state: to },
  });

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
