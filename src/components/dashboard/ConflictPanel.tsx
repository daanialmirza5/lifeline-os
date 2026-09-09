"use client";

import { useState, useTransition } from "react";
import { resolveConflictAction } from "@/app/actions";
import { Button, Card, CardBody, CardHeader, CardTitle } from "@/components/ui/primitives";

export interface ConflictView {
  operationId: string;
  entityId: string;
  taskTitle: string;
  local: unknown;
  server: unknown;
}

export function ConflictPanel({ conflicts }: { conflicts: ConflictView[] }) {
  if (conflicts.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync Conflicts Requiring Resolution</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        {conflicts.map((c) => (
          <ConflictRow key={c.operationId} conflict={c} />
        ))}
      </CardBody>
    </Card>
  );
}

function ConflictRow({ conflict }: { conflict: ConflictView }) {
  const [pending, startTransition] = useTransition();
  const [resolved, setResolved] = useState<string | null>(null);

  if (resolved) {
    return (
      <div className="rounded-md border border-border p-3 text-sm text-muted">
        {conflict.taskTitle}: resolved ({resolved}).
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[var(--risk-moderate)] bg-[var(--risk-moderate-bg)] p-3">
      <p className="text-sm font-medium text-foreground">{conflict.taskTitle}</p>
      <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="font-semibold uppercase tracking-wide text-muted">Local (queued offline)</p>
          <pre className="mt-1 whitespace-pre-wrap text-foreground">{JSON.stringify(conflict.local, null, 2)}</pre>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-wide text-muted">Server</p>
          <pre className="mt-1 whitespace-pre-wrap text-foreground">{JSON.stringify(conflict.server, null, 2)}</pre>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await resolveConflictAction(conflict.operationId, "KEEP_SERVER");
              setResolved("kept server value");
            })
          }
        >
          Keep server value
        </Button>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await resolveConflictAction(conflict.operationId, "APPLY_LOCAL");
              setResolved("applied local value");
            })
          }
        >
          Apply local (offline) value
        </Button>
      </div>
    </div>
  );
}
