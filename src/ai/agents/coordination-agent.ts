import { runAgent } from "../orchestrator";
import { coordinationAgentOutputSchema, CoordinationAgentOutput } from "../schemas";

export interface CoordinationAgentInput {
  openObligations: { id: string; description: string; status: string; dueAt: string }[];
}

export async function runCoordinationAgent(input: CoordinationAgentInput) {
  return runAgent<CoordinationAgentOutput>({
    task: "coordination_actions",
    instructions:
      "Suggest up to 5 concrete coordination actions a care coordinator should take based on the open obligations in DATA. Respond as JSON: { actions: {action: string, rationale: string, priority: 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'}[] }.",
    data: { openObligations: input.openObligations },
    schema: coordinationAgentOutputSchema,
    fallback: {
      actions: input.openObligations.slice(0, 5).map((o) => ({
        action: `Follow up on: ${o.description}`,
        rationale: `Status is ${o.status}, due ${o.dueAt}.`,
        priority: o.status === "OVERDUE" ? ("HIGH" as const) : ("MEDIUM" as const),
      })),
    },
  });
}
