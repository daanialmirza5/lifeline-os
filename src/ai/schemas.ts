import { z } from "zod";

/**
 * Every agent output is validated against one of these schemas before it
 * is allowed to reach the UI or the database. Malformed LLM output never
 * mutates workflow state (spec section 33) — a schema failure falls back
 * to a safe, clearly-labeled default (see src/ai/orchestrator.ts).
 *
 * Required narrative fields use `nonEmptyText()` rather than a bare
 * `z.string()`: an empty (or whitespace-only) string is technically a
 * valid string, so without this a malformed or truncated real-provider
 * response — `{ recommendedAction: "" }`, say — would pass validation and
 * reach a clinician's approval queue as a blank recommendation with
 * nothing to actually review. Forcing at least one non-whitespace
 * character routes that case into runAgent's fallback path instead,
 * same as any other schema failure. Fields that are legitimately allowed
 * to be "unknown" use `.nullable()` instead (null, not an empty string,
 * is the correct way to say that).
 */
const nonEmptyText = () => z.string().trim().min(1);

export const timelineAgentOutputSchema = z.object({
  summary: nonEmptyText(),
  keyEvents: z.array(z.string()).max(10),
});
export type TimelineAgentOutput = z.infer<typeof timelineAgentOutputSchema>;

export const continuityAgentOutputSchema = z.object({
  gaps: z.array(
    z.object({
      description: nonEmptyText(),
      relatedObligationId: z.string().nullable(),
    })
  ),
  overallAssessment: nonEmptyText(),
});
export type ContinuityAgentOutput = z.infer<typeof continuityAgentOutputSchema>;

export const riskExplanationAgentOutputSchema = z.object({
  explanation: nonEmptyText(),
  recommendedAction: nonEmptyText(),
});
export type RiskExplanationAgentOutput = z.infer<typeof riskExplanationAgentOutputSchema>;

export const coordinationAgentOutputSchema = z.object({
  actions: z.array(
    z.object({
      action: nonEmptyText(),
      rationale: nonEmptyText(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    })
  ),
});
export type CoordinationAgentOutput = z.infer<typeof coordinationAgentOutputSchema>;

export const communicationAgentOutputSchema = z.object({
  subject: nonEmptyText(),
  body: nonEmptyText(),
  channel: z.enum(["SMS", "EMAIL", "PORTAL_MESSAGE"]),
});
export type CommunicationAgentOutput = z.infer<typeof communicationAgentOutputSchema>;

export const clinicalSummaryAgentOutputSchema = z.object({
  currentSituation: nonEmptyText(),
  completedActions: z.array(z.string()),
  pendingActions: z.array(z.string()),
  outstandingObligations: z.array(z.string()),
  potentialBlockers: z.array(z.string()),
  questionsForClinician: z.array(z.string()),
});
export type ClinicalSummaryAgentOutput = z.infer<typeof clinicalSummaryAgentOutputSchema>;

export const documentExtractionSchema = z.object({
  documentType: nonEmptyText(),
  provider: z.string().nullable(),
  date: z.string().nullable(),
  patientIdentifierText: z.string().nullable(),
  followUpRequired: z.boolean(),
  summary: nonEmptyText(),
});
export type DocumentExtractionOutput = z.infer<typeof documentExtractionSchema>;
