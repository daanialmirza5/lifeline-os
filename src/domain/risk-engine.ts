import { RiskLevel } from "./types";

/**
 * Deterministic continuity-risk engine.
 *
 * This is intentionally NOT an LLM call. Risk must be explainable and
 * reproducible: same inputs always produce the same score, level, and
 * factor list. The AI layer (risk-explanation agent) may turn this
 * structured output into prose, but it never determines the score itself.
 */

export interface RiskWeights {
  overdueCriticalObligation: number;
  missedAppointment: number;
  unscheduledReferral: number;
  missingDocument: number;
  repeatedFailedContact: number;
  longInactivity: number;
  blockedWorkflow: number;
}

export const DEFAULT_RISK_WEIGHTS: RiskWeights = {
  overdueCriticalObligation: 30,
  missedAppointment: 25,
  unscheduledReferral: 25,
  missingDocument: 15,
  repeatedFailedContact: 15,
  longInactivity: 20,
  blockedWorkflow: 30,
};

export const RISK_THRESHOLDS: { max: number; level: RiskLevel }[] = [
  { max: 24, level: "LOW" },
  { max: 49, level: "MODERATE" },
  { max: 74, level: "HIGH" },
  { max: Infinity, level: "CRITICAL" },
];

export interface RiskSignals {
  overdueCriticalObligationCount: number;
  missedAppointmentCount: number;
  unscheduledReferralCount: number;
  missingDocumentCount: number;
  repeatedFailedContactCount: number;
  inactivityDays: number;
  isJourneyBlocked: boolean;
}

export const DEFAULT_INACTIVITY_THRESHOLD_DAYS = 14;
export const DEFAULT_REPEATED_CONTACT_THRESHOLD = 2;

export interface RiskFactor {
  factor: string;
  weight: number;
}

export interface RiskResult {
  riskScore: number;
  riskLevel: RiskLevel;
  factors: RiskFactor[];
}

export function riskLevelForScore(score: number): RiskLevel {
  const bucket = RISK_THRESHOLDS.find((t) => score <= t.max);
  return (bucket ?? RISK_THRESHOLDS[RISK_THRESHOLDS.length - 1]).level;
}

/**
 * Computes continuity risk from pre-extracted signals. Each category
 * contributes its weight at most once (a flat trigger, not per-item), which
 * keeps the score bounded, predictable, and easy to explain — "unscheduled
 * referral" either is or isn't a live risk factor for this patient right now.
 */
export function computeContinuityRisk(
  signals: RiskSignals,
  weights: RiskWeights = DEFAULT_RISK_WEIGHTS,
  inactivityThresholdDays: number = DEFAULT_INACTIVITY_THRESHOLD_DAYS,
  repeatedContactThreshold: number = DEFAULT_REPEATED_CONTACT_THRESHOLD
): RiskResult {
  const factors: RiskFactor[] = [];

  if (signals.overdueCriticalObligationCount > 0) {
    factors.push({
      factor: `${signals.overdueCriticalObligationCount} overdue critical obligation${
        signals.overdueCriticalObligationCount > 1 ? "s" : ""
      }`,
      weight: weights.overdueCriticalObligation,
    });
  }

  if (signals.missedAppointmentCount > 0) {
    factors.push({
      factor: `${signals.missedAppointmentCount} missed appointment${
        signals.missedAppointmentCount > 1 ? "s" : ""
      }`,
      weight: weights.missedAppointment,
    });
  }

  if (signals.unscheduledReferralCount > 0) {
    factors.push({
      factor: `${signals.unscheduledReferralCount} unscheduled referral${
        signals.unscheduledReferralCount > 1 ? "s" : ""
      }`,
      weight: weights.unscheduledReferral,
    });
  }

  if (signals.missingDocumentCount > 0) {
    factors.push({
      factor: `${signals.missingDocumentCount} missing required document${
        signals.missingDocumentCount > 1 ? "s" : ""
      }`,
      weight: weights.missingDocument,
    });
  }

  if (signals.repeatedFailedContactCount >= repeatedContactThreshold) {
    factors.push({
      factor: `${signals.repeatedFailedContactCount} repeated failed contact attempts`,
      weight: weights.repeatedFailedContact,
    });
  }

  if (signals.inactivityDays >= inactivityThresholdDays) {
    factors.push({
      factor: `No recorded activity for ${signals.inactivityDays} days`,
      weight: weights.longInactivity,
    });
  }

  if (signals.isJourneyBlocked) {
    factors.push({
      factor: "Critical workflow is blocked",
      weight: weights.blockedWorkflow,
    });
  }

  const rawScore = factors.reduce((sum, f) => sum + f.weight, 0);
  const riskScore = Math.min(100, rawScore);

  return {
    riskScore,
    riskLevel: riskLevelForScore(riskScore),
    factors,
  };
}
