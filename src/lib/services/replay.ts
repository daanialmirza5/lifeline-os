import { db } from "@/lib/db";

/**
 * Merges every kind of journey activity — facts (events), interpretations
 * (risk assessments), recommendations, and decisions — into one
 * chronological timeline, so a viewer can step through *why* the system
 * did what it did, not just *what* happened (spec section 51, "Care
 * Pathway Replay"). This is read-only: it reconstructs history from
 * already-stored rows, it doesn't re-run any logic.
 */

export type ReplayStepType =
  | "EVENT"
  | "OBLIGATION_CREATED"
  | "OBLIGATION_RESOLVED"
  | "RISK_COMPUTED"
  | "RECOMMENDATION_SUGGESTED"
  | "RECOMMENDATION_DECIDED"
  | "TASK_CREATED";

export interface ReplayStep {
  at: string;
  type: ReplayStepType;
  title: string;
  detail: string;
  reasoning?: string;
}

export async function buildReplayTimeline(patientId: string, journeyId: string): Promise<ReplayStep[]> {
  const [events, obligations, riskAssessments, recommendations, tasks] = await Promise.all([
    db.careEvent.findMany({ where: { patientId, journeyId }, orderBy: { occurredAt: "asc" } }),
    db.careObligation.findMany({ where: { patientId, journeyId }, orderBy: { createdAt: "asc" } }),
    db.riskAssessment.findMany({ where: { patientId, journeyId }, orderBy: { computedAt: "asc" } }),
    db.aIRecommendation.findMany({ where: { patientId, journeyId }, orderBy: { createdAt: "asc" } }),
    db.task.findMany({ where: { patientId, journeyId }, orderBy: { createdAt: "asc" } }),
  ]);

  const steps: ReplayStep[] = [];

  for (const e of events) {
    steps.push({
      at: e.occurredAt.toISOString(),
      type: "EVENT",
      title: e.title,
      detail: `${e.type.replaceAll("_", " ")} — ${e.status.replaceAll("_", " ")}${e.description ? `. ${e.description}` : ""}`,
    });
  }

  for (const o of obligations) {
    steps.push({
      at: o.createdAt.toISOString(),
      type: "OBLIGATION_CREATED",
      title: "Obligation created",
      detail: o.description,
      reasoning: `Derived automatically from the preceding event. Priority ${o.priority}, due ${o.dueAt.toISOString().slice(0, 10)}.`,
    });
    if (o.completedAt) {
      steps.push({
        at: o.completedAt.toISOString(),
        type: "OBLIGATION_RESOLVED",
        title: "Obligation resolved",
        detail: o.description,
      });
    }
  }

  for (const r of riskAssessments) {
    const factors: { factor: string; weight: number }[] = JSON.parse(r.factors);
    steps.push({
      at: r.computedAt.toISOString(),
      type: "RISK_COMPUTED",
      title: `Continuity risk: ${r.riskLevel} (${r.riskScore}/100)`,
      detail: factors.length > 0 ? factors.map((f) => `${f.factor} (+${f.weight})`).join("; ") : "No active risk factors.",
      reasoning: "Computed deterministically by the rules engine from obligations, referrals, appointments, and activity.",
    });
  }

  for (const rec of recommendations) {
    steps.push({
      at: rec.createdAt.toISOString(),
      type: "RECOMMENDATION_SUGGESTED",
      title: `${rec.agentType.replaceAll("_", " ")} recommendation suggested`,
      detail: rec.recommendation,
      reasoning: rec.reasoning,
    });
    if (rec.decidedAt) {
      steps.push({
        at: rec.decidedAt.toISOString(),
        type: "RECOMMENDATION_DECIDED",
        title: `Recommendation ${rec.status.toLowerCase()}`,
        detail: rec.decisionNotes ?? `Decided by a human reviewer.`,
      });
    }
  }

  for (const t of tasks) {
    steps.push({
      at: t.createdAt.toISOString(),
      type: "TASK_CREATED",
      title: "Coordinator task created",
      detail: t.title,
      reasoning: "Created only after a human approved the recommendation that suggested it.",
    });
  }

  return steps.sort((a, b) => a.at.localeCompare(b.at));
}
