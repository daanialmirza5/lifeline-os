import { db } from "@/lib/db";
import { Card, EmptyState, StatusBadge } from "@/components/ui/primitives";

export default async function PatientObligationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const obligations = await db.careObligation.findMany({
    where: { patientId: id },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    include: { assignedTo: { select: { name: true } }, sourceEvent: { select: { title: true } } },
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Every obligation is an explicit, trackable &ldquo;something must happen&rdquo; derived from a care event —
        not a vague status field.
      </p>
      {obligations.length === 0 ? (
        <EmptyState title="No obligations recorded for this patient" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Source Event</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium">Assigned</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {obligations.map((o) => (
                <tr key={o.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-foreground">{o.description}</td>
                  <td className="px-4 py-3 text-muted">{o.sourceEvent?.title ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{o.priority}</td>
                  <td className="px-4 py-3 text-muted">{o.dueAt.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-3 text-muted">{o.assignedTo?.name ?? "Unassigned"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
