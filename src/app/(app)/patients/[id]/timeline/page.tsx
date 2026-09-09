import { db } from "@/lib/db";
import { Card, CardBody, EmptyState, StatusBadge } from "@/components/ui/primitives";
import Link from "next/link";

const FILTERS = [
  { value: "", label: "All" },
  { value: "CONSULTATION", label: "Consultations" },
  { value: "LAB_ORDER", label: "Labs (Ordered)" },
  { value: "LAB_RESULT", label: "Labs (Results)" },
  { value: "REFERRAL", label: "Referrals" },
  { value: "APPOINTMENT", label: "Appointments" },
  { value: "MEDICATION", label: "Medications" },
  { value: "TASK", label: "Tasks" },
  { value: "DOCUMENT", label: "Documents" },
];

export default async function PatientTimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const { type } = await searchParams;

  const events = await db.careEvent.findMany({
    where: { patientId: id, ...(type ? { type } : {}) },
    orderBy: { occurredAt: "desc" },
  });

  const grouped = new Map<string, typeof events>();
  for (const e of events) {
    const day = e.occurredAt.toISOString().slice(0, 10);
    grouped.set(day, [...(grouped.get(day) ?? []), e]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/patients/${id}/timeline${f.value ? `?type=${f.value}` : ""}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              (type ?? "") === f.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {events.length === 0 ? (
        <EmptyState title="No events match this filter" />
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([day, dayEvents]) => (
            <div key={day}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{day}</p>
              <Card>
                <CardBody className="divide-y divide-border p-0">
                  {dayEvents.map((e) => (
                    <div key={e.id} className="flex items-start justify-between gap-4 px-5 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{e.title}</p>
                        {e.description && <p className="mt-0.5 text-xs text-muted">{e.description}</p>}
                        <p className="mt-1 text-xs text-muted">
                          {e.occurredAt.toISOString().slice(11, 16)} · {e.type.replaceAll("_", " ")}
                        </p>
                      </div>
                      <StatusBadge status={e.status} />
                    </div>
                  ))}
                </CardBody>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
