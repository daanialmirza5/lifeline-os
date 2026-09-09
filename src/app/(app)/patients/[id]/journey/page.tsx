import { db } from "@/lib/db";
import { EmptyState } from "@/components/ui/primitives";
import { JourneyGraph } from "@/components/dashboard/JourneyGraph";
import { JourneyTransitionControls } from "@/components/dashboard/JourneyTransitionControls";

export default async function PatientJourneyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const journey = await db.careJourney.findFirst({
    where: { patientId: id },
    orderBy: { createdAt: "desc" },
    include: {
      events: { orderBy: { occurredAt: "asc" } },
      obligations: { orderBy: { dueAt: "asc" } },
    },
  });

  if (!journey) return <EmptyState title="No care journey found for this patient" />;

  const auditEvents = await db.auditEvent.findMany({
    where: { entityType: "CareEvent", entityId: { in: journey.events.map((e) => e.id) } },
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { name: true } } },
  });

  return (
    <div className="space-y-4">
      <JourneyTransitionControls journeyId={journey.id} currentState={journey.state} patientId={id} />
      <JourneyGraph
        events={journey.events.map((e) => ({
          id: e.id,
          type: e.type,
          status: e.status,
          title: e.title,
          description: e.description,
          occurredAt: e.occurredAt.toISOString(),
          metadata: e.metadata,
        }))}
        obligations={journey.obligations.map((o) => ({
          id: o.id,
          description: o.description,
          status: o.status,
          dueAt: o.dueAt.toISOString(),
          sourceEventId: o.sourceEventId,
        }))}
        auditByEventId={Object.fromEntries(
          journey.events.map((e) => [
            e.id,
            auditEvents
              .filter((a) => a.entityId === e.id)
              .map((a) => ({
                action: a.action,
                actor: a.actor?.name ?? "System",
                at: a.createdAt.toISOString(),
              })),
          ])
        )}
      />
    </div>
  );
}
