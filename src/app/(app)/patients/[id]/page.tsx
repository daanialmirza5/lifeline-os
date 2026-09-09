import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardBody, StatusBadge, EmptyState } from "@/components/ui/primitives";
import { NewReferralForm } from "@/components/dashboard/NewReferralForm";
import { CommunicationDraftForm } from "@/components/dashboard/CommunicationDraftForm";

export default async function PatientOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [patient, journey, recentEvents, openObligations] = await Promise.all([
    db.patient.findUniqueOrThrow({ where: { id } }),
    db.careJourney.findFirst({ where: { patientId: id }, orderBy: { createdAt: "desc" } }),
    db.careEvent.findMany({ where: { patientId: id }, orderBy: { occurredAt: "desc" }, take: 5 }),
    db.careObligation.findMany({
      where: { patientId: id, status: { in: ["OPEN", "IN_PROGRESS", "OVERDUE"] } },
      orderBy: { dueAt: "asc" },
    }),
  ]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Timeline</CardTitle>
          </CardHeader>
          <CardBody>
            {recentEvents.length === 0 ? (
              <EmptyState title="No events recorded yet" />
            ) : (
              <ul className="space-y-3">
                {recentEvents.map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-4 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{e.title}</p>
                      <p className="text-xs text-muted">{e.type.replaceAll("_", " ")}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted">{e.occurredAt.toISOString().slice(0, 10)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open Obligations</CardTitle>
          </CardHeader>
          <CardBody>
            {openObligations.length === 0 ? (
              <EmptyState title="No open obligations" description="Everything required so far has been completed." />
            ) : (
              <ul className="space-y-3">
                {openObligations.map((o) => (
                  <li key={o.id} className="flex items-start justify-between gap-4 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{o.description}</p>
                      <p className="text-xs text-muted">Priority: {o.priority}</p>
                    </div>
                    <StatusBadge status={o.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Journey State</CardTitle>
          </CardHeader>
          <CardBody>{journey ? <StatusBadge status={journey.state} /> : <span className="text-muted">No journey</span>}</CardBody>
        </Card>

        {journey && (
          <Card>
            <CardHeader>
              <CardTitle>New Referral</CardTitle>
            </CardHeader>
            <CardBody>
              <NewReferralForm patientId={id} journeyId={journey.id} />
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Communication Agent</CardTitle>
          </CardHeader>
          <CardBody>
            <CommunicationDraftForm patientId={id} patientName={patient.name} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
