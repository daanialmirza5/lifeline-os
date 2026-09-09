"use client";

import { useActionState } from "react";
import { createReferralAction, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/primitives";

export function NewReferralForm({ patientId, journeyId }: { patientId: string; journeyId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createReferralAction, {});

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="journeyId" value={journeyId} />
      <div>
        <label htmlFor="specialty" className="block text-xs font-medium text-foreground">
          Specialty
        </label>
        <input
          id="specialty"
          name="specialty"
          required
          placeholder="e.g. Cardiology"
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="notes" className="block text-xs font-medium text-foreground">
          Notes (optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      {state?.error && <p className="text-xs text-[var(--risk-critical)]">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating..." : "Create Referral"}
      </Button>
    </form>
  );
}
