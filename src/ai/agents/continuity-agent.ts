import { runAgent } from "../orchestrator";
import { continuityAgentOutputSchema, ContinuityAgentOutput } from "../schemas";

export interface ContinuityAgentInput {
  openObligations: { id: string; description: string; status: string; dueAt: string }[];
}

export async function runContinuityAgent(input: ContinuityAgentInput) {
  return runAgent<ContinuityAgentOutput>({
    task: "continuity_gaps",
    instructions:
      "Identify potential continuity gaps from the open obligations in DATA (especially overdue ones). For each gap give a short description and the related obligation id, or null if it isn't tied to one obligation. Then a 1-sentence overall assessment. Respond as JSON: { gaps: {description: string, relatedObligationId: string|null}[], overallAssessment: string }.",
    data: { openObligations: input.openObligations },
    schema: continuityAgentOutputSchema,
    fallback: {
      gaps: input.openObligations
        .filter((o) => o.status === "OVERDUE")
        .map((o) => ({ description: `${o.description} is overdue.`, relatedObligationId: o.id })),
      overallAssessment: "Continuity analysis is unavailable right now.",
    },
  });
}
