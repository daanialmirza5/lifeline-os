"use client";

import { useMemo, useState } from "react";
import ReactFlow, { Background, Controls, Edge, MarkerType, Node, Position } from "reactflow";
import "reactflow/dist/style.css";
import { Card, CardBody, CardHeader, CardTitle, StatusBadge } from "@/components/ui/primitives";
import { CareEventType } from "@/domain/types";
import { formatDateTime } from "@/lib/format";

interface EventView {
  id: string;
  type: string;
  status: string;
  title: string;
  description: string | null;
  occurredAt: string;
  metadata: string | null;
}
interface ObligationView {
  id: string;
  description: string;
  status: string;
  dueAt: string;
  sourceEventId: string;
}
interface AuditEntry {
  action: string;
  actor: string;
  at: string;
}

const PATHWAY_ORDER: CareEventType[] = [
  "CONSULTATION",
  "LAB_ORDER",
  "LAB_RESULT",
  "CARE_PLAN",
  "REFERRAL",
  "APPOINTMENT",
  "FOLLOW_UP",
];

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: "var(--risk-low)",
  ACTIVE: "var(--accent)",
  PENDING: "var(--muted)",
  OVERDUE: "var(--risk-high)",
  BLOCKED: "var(--risk-critical)",
  CANCELLED: "var(--muted)",
  FAILED: "var(--risk-critical)",
  REQUIRES_APPROVAL: "var(--risk-moderate)",
};

export function JourneyGraph({
  events,
  obligations,
  auditByEventId,
}: {
  events: EventView[];
  obligations: ObligationView[];
  auditByEventId: Record<string, AuditEntry[]>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { nodes, edges } = useMemo(() => {
    const byType = new Map<string, EventView>();
    for (const e of events) {
      const existing = byType.get(e.type);
      if (!existing || e.occurredAt > existing.occurredAt) byType.set(e.type, e);
    }

    const n: Node[] = [];
    const e: Edge[] = [];

    PATHWAY_ORDER.forEach((type, i) => {
      const event = byType.get(type);
      const id = event?.id ?? `placeholder-${type}`;
      n.push({
        id,
        position: { x: 0, y: i * 110 },
        data: {
          label: (
            <div className="text-left">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{type.replaceAll("_", " ")}</p>
              <p className="text-sm font-medium">{event ? event.title : "Not yet occurred"}</p>
              <p className="text-xs opacity-80">{event ? event.status.replaceAll("_", " ") : "PENDING"}</p>
            </div>
          ),
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        style: {
          border: `2px solid ${STATUS_COLOR[event?.status ?? "PENDING"]}`,
          borderStyle: event ? "solid" : "dashed",
          borderRadius: 8,
          padding: 8,
          width: 260,
          background: "var(--surface)",
          color: "var(--foreground)",
        },
      });

      if (i > 0) {
        const prevType = PATHWAY_ORDER[i - 1];
        const prevEvent = byType.get(prevType);
        const sourceId = prevEvent?.id ?? `placeholder-${prevType}`;
        e.push({
          id: `${sourceId}-${id}`,
          source: sourceId,
          target: id,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: "var(--border)" },
        });
      }
    });

    return { nodes: n, edges: e };
  }, [events]);

  const selectedEvent = events.find((e) => e.id === selectedId);
  const relatedObligations = obligations.filter((o) => o.sourceEventId === selectedId);
  const audit = selectedId ? auditByEventId[selectedId] ?? [] : [];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Care Pathway</CardTitle>
        </CardHeader>
        <div style={{ height: 560 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodeClick={(_, node) => setSelectedId(node.id.startsWith("placeholder-") ? null : node.id)}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event Detail</CardTitle>
        </CardHeader>
        <CardBody>
          {!selectedEvent ? (
            <p className="text-sm text-muted">Click a node to inspect it.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-medium text-foreground">{selectedEvent.title}</p>
                <p className="text-xs text-muted">{selectedEvent.type.replaceAll("_", " ")}</p>
              </div>
              <StatusBadge status={selectedEvent.status} />
              {selectedEvent.description && <p className="text-muted">{selectedEvent.description}</p>}
              <p className="text-xs text-muted">Occurred: {formatDateTime(selectedEvent.occurredAt)}</p>

              {relatedObligations.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Dependent obligations</p>
                  <ul className="mt-1 space-y-1">
                    {relatedObligations.map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-2">
                        <span>{o.description}</span>
                        <StatusBadge status={o.status} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Audit history</p>
                {audit.length === 0 ? (
                  <p className="mt-1 text-xs text-muted">No audit entries.</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-xs">
                    {audit.map((a, i) => (
                      <li key={i}>
                        {formatDateTime(a.at)} — <span className="font-medium">{a.action}</span> by {a.actor}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
