import { db } from "@/lib/db";
import { EmptyState } from "@/components/ui/primitives";
import { buildReplayTimeline } from "@/lib/services/replay";
import { CarePathwayReplay } from "@/components/dashboard/CarePathwayReplay";

export default async function PatientReplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const journey = await db.careJourney.findFirst({ where: { patientId: id }, orderBy: { createdAt: "desc" } });

  if (!journey) return <EmptyState title="No care journey found for this patient" />;

  const steps = await buildReplayTimeline(id, journey.id);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Step through this patient&apos;s journey in the order it actually happened — including obligations
        Lifeline OS created automatically, risk recalculations, AI recommendations with their reasoning, and the
        human decisions that turned them into action. This demonstrates that Lifeline OS is an event-driven
        decision system, not just a record store.
      </p>
      <CarePathwayReplay steps={steps} />
    </div>
  );
}
