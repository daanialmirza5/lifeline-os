import { db } from "@/lib/db";
import { Card, EmptyState } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/format";

export default async function AuditPage() {
  const events = await db.auditEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { name: true } } },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Audit Trail</h1>
        <p className="text-sm text-muted">
          Append-only log of every consequential action. Nothing here can be edited or deleted through the
          application layer.
        </p>
      </div>

      {events.length === 0 ? (
        <EmptyState title="No audit events recorded" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-4 py-2 font-medium">Actor</th>
                <th className="px-4 py-2 font-medium">Action</th>
                <th className="px-4 py-2 font-medium">Entity</th>
                <th className="px-4 py-2 font-medium">Previous → New</th>
                <th className="px-4 py-2 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 text-muted">{formatDateTime(e.createdAt)}</td>
                  <td className="px-4 py-2 text-foreground">
                    {e.actor?.name ?? "System"} {e.actorRole ? `(${e.actorRole})` : ""}
                  </td>
                  <td className="px-4 py-2 font-medium text-foreground">{e.action}</td>
                  <td className="px-4 py-2 text-muted">
                    {e.entityType} · {e.entityId.slice(0, 10)}
                  </td>
                  <td className="px-4 py-2 text-muted">
                    {e.previousState ?? "—"} → {e.newState ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-muted">{e.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
