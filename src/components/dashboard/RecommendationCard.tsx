"use client";

import { useState, useTransition } from "react";
import { approveRecommendationAction, rejectRecommendationAction } from "@/app/actions";
import { Button } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/format";

export interface RecommendationView {
  id: string;
  patientName: string;
  agentType: string;
  recommendation: string;
  reasoning: string;
  evidence: string[];
  confidence: number;
  status: string;
  provider: string | null;
  model: string | null;
  createdAt: string;
  decisionNotes: string | null;
}

export function RecommendationCard({ rec, redirectTo }: { rec: RecommendationView; redirectTo: string }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [editedText, setEditedText] = useState(rec.recommendation);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (done) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
        {rec.patientName}: {done}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">{rec.agentType.replaceAll("_", " ")}</p>
          <p className="text-sm font-medium text-foreground">{rec.patientName}</p>
        </div>
        <span className="text-xs text-muted">Confidence {Math.round(rec.confidence * 100)}%</span>
      </div>

      <div className="mt-3 space-y-2 text-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Recommendation</p>
          {editing ? (
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm whitespace-pre-wrap"
            />
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-foreground">{rec.recommendation}</p>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Why</p>
          <p className="mt-1 text-foreground">{rec.reasoning}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Evidence</p>
          <ul className="mt-1 list-inside list-disc text-muted">
            {rec.evidence.map((ev, i) => (
              <li key={i}>{ev}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted">
          {rec.provider ?? "unknown"} ({rec.model ?? "n/a"}) · {formatDateTime(rec.createdAt)}
        </p>
      </div>

      {rec.status === "SUGGESTED" ? (
        <div className="mt-4 space-y-2">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Decision notes (optional)"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs"
          />
          {error && <p className="text-xs text-[var(--risk-critical)]">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await approveRecommendationAction(
                      rec.id,
                      notes || undefined,
                      editing ? editedText : undefined,
                      redirectTo
                    );
                    setDone(editing ? "Approved (edited)." : "Approved.");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Failed to approve.");
                  }
                })
              }
            >
              {editing ? "Approve edited" : "Approve"}
            </Button>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? "Cancel edit" : "Edit"}
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await rejectRecommendationAction(rec.id, notes || undefined, redirectTo);
                    setDone("Rejected.");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Failed to reject.");
                  }
                })
              }
            >
              Reject
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 border-t border-border pt-3 text-xs text-muted">
          Status: <span className="font-medium text-foreground">{rec.status}</span>
          {rec.decisionNotes && <> — {rec.decisionNotes}</>}
        </div>
      )}
    </div>
  );
}
