"use client";

import { useState, useTransition } from "react";
import { transitionJourneyAction } from "@/app/actions";
import { Button, StatusBadge } from "@/components/ui/primitives";
import { JOURNEY_TRANSITIONS, JourneyState } from "@/domain/types";

export function JourneyTransitionControls({
  journeyId,
  currentState,
  patientId,
}: {
  journeyId: string;
  currentState: string;
  patientId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const options = JOURNEY_TRANSITIONS[currentState as JourneyState] ?? [];

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted">Journey state:</span>
        <StatusBadge status={currentState} />
      </div>
      {options.length > 0 ? (
        <div className="flex items-center gap-2">
          {options.map((next) => (
            <Button
              key={next}
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  try {
                    await transitionJourneyAction(journeyId, next, `/patients/${patientId}/journey`);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Transition failed.");
                  }
                });
              }}
            >
              Move to {next.replaceAll("_", " ")}
            </Button>
          ))}
        </div>
      ) : (
        <span className="text-xs text-muted">Terminal state — no further transitions.</span>
      )}
      {error && <span className="text-xs text-[var(--risk-critical)]">{error}</span>}
    </div>
  );
}
