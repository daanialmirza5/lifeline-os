import { db } from "@/lib/db";
import { Card, CardBody, EmptyState, StatusBadge } from "@/components/ui/primitives";
import { ScheduleAppointmentForm } from "@/components/dashboard/ScheduleAppointmentForm";
import Link from "next/link";
import { formatDate } from "@/lib/format";

export default async function ReferralsPage() {
  const referrals = await db.referral.findMany({
    orderBy: { createdAt: "desc" },
    include: { patient: { select: { id: true, name: true } } },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Referral Coordination</h1>
        <p className="text-sm text-muted">Track every specialist referral from creation through scheduling.</p>
      </div>

      {referrals.length === 0 ? (
        <EmptyState title="No referrals recorded" />
      ) : (
        <div className="space-y-3">
          {referrals.map((r) => (
            <Card key={r.id}>
              <CardBody className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <Link href={`/patients/${r.patient.id}`} className="text-sm font-medium text-foreground hover:underline">
                    {r.patient.name}
                  </Link>
                  <p className="text-sm text-muted">Referral to {r.specialty}</p>
                  {r.notes && <p className="mt-1 text-xs text-muted">{r.notes}</p>}
                  <p className="mt-1 text-xs text-muted">Created {formatDate(r.createdAt)}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={r.status} />
                  {r.status === "PENDING" && (
                    <ScheduleAppointmentForm
                      patientId={r.patient.id}
                      journeyId={r.journeyId}
                      referralId={r.id}
                      specialty={r.specialty}
                    />
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
