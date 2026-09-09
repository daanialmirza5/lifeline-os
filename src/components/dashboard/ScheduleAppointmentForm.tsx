"use client";

import { useActionState, useState } from "react";
import { scheduleAppointmentAction, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/primitives";

export function ScheduleAppointmentForm({
  patientId,
  journeyId,
  referralId,
  specialty,
}: {
  patientId: string;
  journeyId: string;
  referralId: string;
  specialty: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(scheduleAppointmentAction, {});

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Schedule appointment
      </Button>
    );
  }

  return (
    <form action={formAction} className="mt-2 space-y-2 rounded-md border border-border p-3">
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="journeyId" value={journeyId} />
      <input type="hidden" name="referralId" value={referralId} />
      <input type="hidden" name="type" value={`${specialty} consultation`} />
      <div>
        <label className="block text-xs font-medium text-foreground">Provider</label>
        <input name="provider" required className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-foreground">Date &amp; time</label>
        <input
          type="datetime-local"
          name="scheduledAt"
          required
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        />
      </div>
      {state?.error && <p className="text-xs text-[var(--risk-critical)]">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Scheduling..." : "Confirm"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
