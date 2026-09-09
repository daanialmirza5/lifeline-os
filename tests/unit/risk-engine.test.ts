import { describe, it, expect } from "vitest";
import {
  computeContinuityRisk,
  riskLevelForScore,
  DEFAULT_RISK_WEIGHTS,
  RiskSignals,
} from "@/domain/risk-engine";

const ZERO_SIGNALS: RiskSignals = {
  overdueCriticalObligationCount: 0,
  missedAppointmentCount: 0,
  unscheduledReferralCount: 0,
  missingDocumentCount: 0,
  repeatedFailedContactCount: 0,
  inactivityDays: 0,
  isJourneyBlocked: false,
};

describe("risk-engine: riskLevelForScore", () => {
  it.each([
    [0, "LOW"],
    [24, "LOW"],
    [25, "MODERATE"],
    [49, "MODERATE"],
    [50, "HIGH"],
    [74, "HIGH"],
    [75, "CRITICAL"],
    [100, "CRITICAL"],
  ] as const)("score %i -> %s", (score, level) => {
    expect(riskLevelForScore(score)).toBe(level);
  });
});

describe("risk-engine: computeContinuityRisk", () => {
  it("returns LOW with no factors when nothing is wrong", () => {
    const result = computeContinuityRisk(ZERO_SIGNALS);
    expect(result.riskScore).toBe(0);
    expect(result.riskLevel).toBe("LOW");
    expect(result.factors).toEqual([]);
  });

  it("is deterministic: identical input always produces identical output", () => {
    const signals: RiskSignals = {
      ...ZERO_SIGNALS,
      overdueCriticalObligationCount: 1,
      inactivityDays: 20,
    };
    const a = computeContinuityRisk(signals);
    const b = computeContinuityRisk(signals);
    expect(a).toEqual(b);
  });

  it("sums exactly the weights of active factors", () => {
    const signals: RiskSignals = {
      ...ZERO_SIGNALS,
      overdueCriticalObligationCount: 1, // +30
      missedAppointmentCount: 1, // +25
    };
    const result = computeContinuityRisk(signals);
    expect(result.riskScore).toBe(55);
    expect(result.riskLevel).toBe("HIGH");
    expect(result.factors).toHaveLength(2);
  });

  it("triggers each factor category independently", () => {
    expect(
      computeContinuityRisk({ ...ZERO_SIGNALS, unscheduledReferralCount: 2 }).factors[0].weight
    ).toBe(DEFAULT_RISK_WEIGHTS.unscheduledReferral);
    expect(
      computeContinuityRisk({ ...ZERO_SIGNALS, missingDocumentCount: 1 }).factors[0].weight
    ).toBe(DEFAULT_RISK_WEIGHTS.missingDocument);
    expect(
      computeContinuityRisk({ ...ZERO_SIGNALS, isJourneyBlocked: true }).factors[0].weight
    ).toBe(DEFAULT_RISK_WEIGHTS.blockedWorkflow);
  });

  it("does not trigger the inactivity factor below the threshold", () => {
    const result = computeContinuityRisk({ ...ZERO_SIGNALS, inactivityDays: 13 });
    expect(result.factors).toEqual([]);
  });

  it("triggers the inactivity factor at the threshold", () => {
    const result = computeContinuityRisk({ ...ZERO_SIGNALS, inactivityDays: 14 });
    expect(result.factors).toHaveLength(1);
  });

  it("does not trigger repeated-contact below its threshold", () => {
    const result = computeContinuityRisk({ ...ZERO_SIGNALS, repeatedFailedContactCount: 1 });
    expect(result.factors).toEqual([]);
  });

  it("clamps the score at 100 even when every factor is active", () => {
    const allActive: RiskSignals = {
      overdueCriticalObligationCount: 1,
      missedAppointmentCount: 1,
      unscheduledReferralCount: 1,
      missingDocumentCount: 1,
      repeatedFailedContactCount: 2,
      inactivityDays: 30,
      isJourneyBlocked: true,
    };
    const result = computeContinuityRisk(allActive);
    expect(result.riskScore).toBe(100);
    expect(result.riskLevel).toBe("CRITICAL");
  });

  it("respects custom weights", () => {
    const customWeights = { ...DEFAULT_RISK_WEIGHTS, blockedWorkflow: 5 };
    const result = computeContinuityRisk({ ...ZERO_SIGNALS, isJourneyBlocked: true }, customWeights);
    expect(result.riskScore).toBe(5);
    expect(result.riskLevel).toBe("LOW");
  });
});
