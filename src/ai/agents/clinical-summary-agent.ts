import { runAgent } from "../orchestrator";
import { clinicalSummaryAgentOutputSchema, ClinicalSummaryAgentOutput } from "../schemas";

export interface ClinicalSummaryAgentInput {
  events: { title: string; type: string; status: string; occurredAt: string }[];
  openObligations: { id: string; description: string; status: string; dueAt: string }[];
}

export async function runClinicalSummaryAgent(input: ClinicalSummaryAgentInput) {
  return runAgent<ClinicalSummaryAgentOutput>({
    task: "clinical_summary",
    instructions:
      "Produce a structured administrative summary of this patient's record for a clinician to review before their visit. Do NOT diagnose or suggest treatment — only organize what is already in DATA. Respond as JSON: { currentSituation: string, completedActions: string[], pendingActions: string[], outstandingObligations: string[], potentialBlockers: string[], questionsForClinician: string[] }.",
    data: { events: input.events, openObligations: input.openObligations },
    schema: clinicalSummaryAgentOutputSchema,
    fallback: {
      currentSituation: `${input.events.length} recorded event(s), ${input.openObligations.length} open obligation(s).`,
      completedActions: input.events.filter((e) => e.status === "COMPLETED").map((e) => e.title),
      pendingActions: input.events.filter((e) => e.status !== "COMPLETED").map((e) => e.title),
      outstandingObligations: input.openObligations.map((o) => o.description),
      potentialBlockers: input.openObligations
        .filter((o) => o.status === "OVERDUE")
        .map((o) => o.description),
      questionsForClinician: [],
    },
  });
}
