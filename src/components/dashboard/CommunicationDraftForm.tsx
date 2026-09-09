"use client";

import { useActionState } from "react";
import { generateCommunicationDraftAction, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/primitives";

export function CommunicationDraftForm({ patientId, patientName }: { patientId: string; patientName: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(generateCommunicationDraftAction, {});

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="patientName" value={patientName} />
      <div>
        <label htmlFor="purpose" className="block text-xs font-medium text-foreground">
          Purpose of message
        </label>
        <input
          id="purpose"
          name="purpose"
          required
          placeholder="e.g. appointment reminder, missing document follow-up"
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      {state?.error && <p className="text-xs text-[var(--risk-critical)]">{state.error}</p>}
      <Button type="submit" disabled={pending} variant="secondary" className="w-full">
        {pending ? "Drafting..." : "Draft patient message with AI"}
      </Button>
      <p className="text-xs text-muted">Draft appears in the Approval Queue for review before use.</p>
    </form>
  );
}
