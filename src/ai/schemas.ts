import { z } from "zod";

/**
 * Every agent output is validated against one of these schemas before it
 * is allowed to reach the UI or the database. Malformed LLM output never
 * mutates workflow state (spec section 33) — a schema failure falls back
 * to a safe, clearly-labeled default (see src/ai/orchestrator.ts).
 */

export const timelineAgentOutputSchema = z.object({
  summary: z.string(),
  keyEvents: z.array(z.string()).max(10),
});
export type TimelineAgentOutput = z.infer<typeof timelineAgentOutputSchema>;

export const continuityAgentOutputSchema = z.object({
  gaps: z.array(
    z.object({
      description: z.string(),
      relatedObligationId: z.string().nullable(),
    })
  ),
  overallAssessment: z.string(),
});
export type ContinuityAgentOutput = z.infer<typeof continuityAgentOutputSchema>;

export const riskExplanationAgentOutputSchema = z.object({
  explanation: z.string(),
  recommendedAction: z.string(),
});
export type RiskExplanationAgentOutput = z.infer<typeof riskExplanationAgentOutputSchema>;

export const coordinationAgentOutputSchema = z.object({
  actions: z.array(
    z.object({
      action: z.string(),
      rationale: z.string(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    })
  ),
});
export type CoordinationAgentOutput = z.infer<typeof coordinationAgentOutputSchema>;

export const communicationAgentOutputSchema = z.object({
  subject: z.string(),
  body: z.string(),
  channel: z.enum(["SMS", "EMAIL", "PORTAL_MESSAGE"]),
});
export type CommunicationAgentOutput = z.infer<typeof communicationAgentOutputSchema>;

export const clinicalSummaryAgentOutputSchema = z.object({
  currentSituation: z.string(),
  completedActions: z.array(z.string()),
  pendingActions: z.array(z.string()),
  outstandingObligations: z.array(z.string()),
  potentialBlockers: z.array(z.string()),
  questionsForClinician: z.array(z.string()),
});
export type ClinicalSummaryAgentOutput = z.infer<typeof clinicalSummaryAgentOutputSchema>;

export const documentExtractionSchema = z.object({
  documentType: z.string(),
  provider: z.string().nullable(),
  date: z.string().nullable(),
  patientIdentifierText: z.string().nullable(),
  followUpRequired: z.boolean(),
  summary: z.string(),
});
export type DocumentExtractionOutput = z.infer<typeof documentExtractionSchema>;
