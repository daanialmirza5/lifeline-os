import { db } from "@/lib/db";
import { EmptyState } from "@/components/ui/primitives";
import { TaskRow } from "@/components/dashboard/TaskRow";
import { ConflictPanel } from "@/components/dashboard/ConflictPanel";

export default async function TasksPage() {
  const [tasks, conflicts] = await Promise.all([
    db.task.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      include: { patient: { select: { name: true } } },
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
    }),
    db.syncOperation.findMany({
      where: { syncStatus: "CONFLICT" },
      include: { user: { select: { name: true } } },
    }),
  ]);

  const conflictTaskIds = conflicts.map((c) => c.entityId);
  const conflictTasks = await db.task.findMany({ where: { id: { in: conflictTaskIds } } });
  const taskById = new Map(conflictTasks.map((t) => [t.id, t]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Tasks</h1>
        <p className="text-sm text-muted">
          Open coordinator and clinical tasks. Actions taken while offline are queued in your browser
          (IndexedDB) and synced automatically when connectivity returns — try DevTools &quot;Offline&quot; mode.
        </p>
      </div>

      <ConflictPanel
        conflicts={conflicts.map((c) => ({
          operationId: c.operationId,
          entityId: c.entityId,
          taskTitle: taskById.get(c.entityId)?.title ?? c.entityId,
          local: c.conflictDetails ? JSON.parse(c.conflictDetails).local : null,
          server: c.conflictDetails ? JSON.parse(c.conflictDetails).server : null,
        }))}
      />

      {tasks.length === 0 ? (
        <EmptyState title="No open tasks" description="Everything is acknowledged or completed." />
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={{
                id: t.id,
                title: t.title,
                description: t.description,
                status: t.status,
                priority: t.priority,
                version: t.version,
                patientName: t.patient.name,
                assignedRole: t.assignedRole,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
