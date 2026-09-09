"use client";

import { useState, useTransition } from "react";
import { updateTaskStatusAction } from "@/app/actions";
import { useOffline } from "@/offline/OfflineProvider";
import { Button, StatusBadge } from "@/components/ui/primitives";
import { TaskStatus } from "@/domain/types";

export interface TaskView {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  version: number;
  patientName: string;
  assignedRole: string | null;
}

const NEXT_STATUS: Record<string, { label: string; status: TaskStatus; operationType: "ACKNOWLEDGE" | "UPDATE_STATUS" }> = {
  OPEN: { label: "Acknowledge", status: "IN_PROGRESS", operationType: "ACKNOWLEDGE" },
  IN_PROGRESS: { label: "Mark complete", status: "COMPLETED", operationType: "UPDATE_STATUS" },
};

export function TaskRow({ task }: { task: TaskView }) {
  const { isOnline, queueTaskUpdate } = useOffline();
  const [pending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState(task.status);
  const [queuedOffline, setQueuedOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = NEXT_STATUS[localStatus];

  async function handleClick() {
    if (!next) return;
    setError(null);

    if (isOnline) {
      startTransition(async () => {
        try {
          await updateTaskStatusAction(task.id, next.status, task.version, "/tasks");
          setLocalStatus(next.status);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Update failed.");
        }
      });
    } else {
      await queueTaskUpdate({
        taskId: task.id,
        operationType: next.operationType,
        payload: { status: next.status },
        baseVersion: task.version,
      });
      setLocalStatus(next.status);
      setQueuedOffline(true);
    }
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface p-4">
      <div>
        <p className="text-sm font-medium text-foreground">{task.title}</p>
        {task.description && <p className="mt-0.5 text-xs text-muted">{task.description}</p>}
        <p className="mt-1 text-xs text-muted">
          {task.patientName} · {task.assignedRole ?? "Unassigned role"} · Priority {task.priority}
        </p>
        {error && <p className="mt-1 text-xs text-[var(--risk-critical)]">{error}</p>}
        {queuedOffline && (
          <p className="mt-1 text-xs text-[var(--risk-moderate)]">
            Queued locally — will sync automatically when back online.
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <StatusBadge status={localStatus} />
        {next && (
          <Button variant="secondary" disabled={pending} onClick={handleClick}>
            {next.label}
          </Button>
        )}
      </div>
    </div>
  );
}
