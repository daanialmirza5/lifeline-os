"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, CardBody } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/format";
import type { ReplayStep, ReplayStepType } from "@/lib/services/replay";

const TYPE_LABEL: Record<ReplayStepType, string> = {
  EVENT: "Event",
  OBLIGATION_CREATED: "Obligation created",
  OBLIGATION_RESOLVED: "Obligation resolved",
  RISK_COMPUTED: "Risk recomputed",
  RECOMMENDATION_SUGGESTED: "AI recommendation",
  RECOMMENDATION_DECIDED: "Human decision",
  TASK_CREATED: "Task created",
};

const TYPE_COLOR: Record<ReplayStepType, string> = {
  EVENT: "var(--muted)",
  OBLIGATION_CREATED: "var(--risk-moderate)",
  OBLIGATION_RESOLVED: "var(--risk-low)",
  RISK_COMPUTED: "var(--accent)",
  RECOMMENDATION_SUGGESTED: "var(--primary)",
  RECOMMENDATION_DECIDED: "var(--risk-low)",
  TASK_CREATED: "var(--risk-moderate)",
};

export function CarePathwayReplay({ steps }: { steps: ReplayStep[] }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!playing) return;
    timerRef.current = setInterval(() => {
      setIndex((i) => {
        if (i >= steps.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 1800);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, steps.length]);

  if (steps.length === 0) {
    return <p className="text-sm text-muted">Nothing to replay yet — this journey has no recorded activity.</p>;
  }

  const current = steps[index];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardBody>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: TYPE_COLOR[current.type] }}>
              {TYPE_LABEL[current.type]}
            </p>
            <p className="text-xs text-muted">
              Step {index + 1} of {steps.length}
            </p>
          </div>
          <h3 className="mt-1 text-lg font-semibold text-foreground">{current.title}</h3>
          <p className="mt-1 text-xs text-muted">{formatDateTime(current.at)}</p>
          <p className="mt-3 text-sm text-foreground">{current.detail}</p>
          {current.reasoning && (
            <div className="mt-3 rounded-md border border-border bg-background p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">System reasoning</p>
              <p className="mt-1 text-sm text-foreground">{current.reasoning}</p>
            </div>
          )}

          <div className="mt-5 flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
            >
              Previous
            </Button>
            <Button
              onClick={() => setPlaying((p) => !p)}
              disabled={index >= steps.length - 1 && !playing}
            >
              {playing ? "Pause" : "Play"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setIndex((i) => Math.min(steps.length - 1, i + 1))}
              disabled={index >= steps.length - 1}
            >
              Next
            </Button>
            <Button variant="ghost" onClick={() => { setIndex(0); setPlaying(false); }}>
              Restart
            </Button>
          </div>

          <div className="mt-4 h-1.5 w-full rounded-full bg-black/5 dark:bg-white/10">
            <div
              className="h-1.5 rounded-full bg-primary transition-[width]"
              style={{ width: `${((index + 1) / steps.length) * 100}%` }}
            />
          </div>
        </CardBody>
      </Card>

      <Card className="max-h-[500px] overflow-y-auto">
        <CardBody className="space-y-1 p-2">
          {steps.map((step, i) => (
            <button
              key={i}
              onClick={() => {
                setPlaying(false);
                setIndex(i);
              }}
              className={`block w-full rounded-md px-3 py-2 text-left text-xs ${
                i === index ? "bg-primary text-primary-foreground" : "hover:bg-black/[.04] dark:hover:bg-white/[.06]"
              }`}
            >
              <span className="font-medium">{TYPE_LABEL[step.type]}</span>
              <span className="block truncate opacity-80">{step.title}</span>
            </button>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
