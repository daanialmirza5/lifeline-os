import { runAgent } from "../orchestrator";
import { riskExplanationAgentOutputSchema, RiskExplanationAgentOutput } from "../schemas";
import { RiskFactor } from "@/domain/risk-engine";

export interface RiskExplanationAgentInput {
  riskScore: number;
  riskLevel: string;
  factors: RiskFactor[];
}

export async function runRiskExplanationAgent(input: RiskExplanationAgentInput) {
  return runAgent<RiskExplanationAgentOutput>({
    task: "risk_explanation",
    instructions:
      "Explain in plain language why this patient has the given continuity risk score, using ONLY the riskScore/riskLevel/factors in DATA — these numbers were computed by a deterministic rules engine, not by you; do not recompute or contradict them. Then suggest one recommended next action. Respond as JSON: { explanation: string, recommendedAction: string }.",
    data: { riskScore: input.riskScore, riskLevel: input.riskLevel, factors: input.factors },
    schema: riskExplanationAgentOutputSchema,
    fallback: {
      explanation: `Risk level is ${input.riskLevel} (score ${input.riskScore}/100) based on ${input.factors.length} factor(s).`,
      recommendedAction: input.factors[0]
        ? `Address: ${input.factors[0].factor}`
        : "No action required.",
    },
  });
}
