"use client";

import { useState, useTransition } from "react";
import { validateDocumentAction, rejectDocumentAction } from "@/app/actions";
import { Button, StatusBadge } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/format";

export interface DocumentView {
  id: string;
  patientName: string;
  filename: string;
  docType: string | null;
  status: string;
  extractedFields: string | null;
  uploadedAt: string;
}

export function DocumentReviewCard({ doc }: { doc: DocumentView }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fields = doc.extractedFields ? JSON.parse(doc.extractedFields) : null;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{doc.filename}</p>
          <p className="text-xs text-muted">{doc.patientName} · {formatDateTime(doc.uploadedAt)}</p>
        </div>
        <StatusBadge status={doc.status} />
      </div>

      {fields && (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          {Object.entries(fields).map(([key, value]) => (
            <div key={key}>
              <dt className="font-semibold uppercase tracking-wide text-muted">{key}</dt>
              <dd className="text-foreground">{value === null || value === "" ? "—" : String(value)}</dd>
            </div>
          ))}
        </dl>
      )}

      {doc.status === "EXTRACTED" && (
        <div className="mt-3 space-y-2">
          {error && <p className="text-xs text-[var(--risk-critical)]">{error}</p>}
          <p className="text-xs text-muted">Extracted fields shown above are AI-generated — review before accepting.</p>
          <div className="flex gap-2">
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await validateDocumentAction(doc.id, fields ?? {});
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Failed to validate.");
                  }
                })
              }
            >
              Accept & add to timeline
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await rejectDocumentAction(doc.id, "Extraction rejected during human review.");
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
      )}
    </div>
  );
}
