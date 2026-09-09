import { db } from "@/lib/db";
import {
  computeContinuityRisk,
  RiskSignals,
  DEFAULT_RISK_WEIGHTS,
  RiskWeights,
} from "@/domain/risk-engine";

const UNSCHEDULED_REFERRAL_THRESHOLD_DAYS = 3;

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Lazily promotes obligations/appointments past their due date to
 * OVERDUE/MISSED. There is no background scheduler in this prototype, so
 * this runs on every risk computation (spec section 57: working core over
 * infrastructure) — a real deployment would run this as a periodic job
 * instead of (or in addition to) on-read.
 */
async function promoteOverdueRecords(patientId: string) {
  const now = new Date();

  await db.careObligation.updateMany({
    where: {
      patientId,
      status: { in: ["OPEN", "IN_PROGRESS"] },
      dueAt: { lt: now },
    },
    data: { status: "OVERDUE" },
  });

  await db.appointment.updateMany({
    where: {
      patientId,
      status: "SCHEDULED",
      scheduledAt: { lt: now },
    },
    data: { status: "MISSED" },
  });
}

async function extractRiskSignals(patientId: string, journeyId: string): Promise<RiskSignals> {
  await promoteOverdueRecords(patientId);

  const now = new Date();

  const [overdueCriticalObligationCount, missedAppointmentCount, referrals, lastEvent, journey] =
    await Promise.all([
      db.careObligation.count({
        where: { journeyId, status: "OVERDUE", priority: { in: ["CRITICAL", "HIGH"] } },
      }),
      db.appointment.count({ where: { patientId, journeyId, status: "MISSED" } }),
      db.referral.findMany({ where: { patientId, journeyId, status: "PENDING" } }),
      db.careEvent.findFirst({ where: { patientId, journeyId }, orderBy: { occurredAt: "desc" } }),
      db.careJourney.findUniqueOrThrow({ where: { id: journeyId } }),
    ]);

  const unscheduledReferralCount = referrals.filter(
    (r) => daysBetween(now, r.createdAt) >= UNSCHEDULED_REFERRAL_THRESHOLD_DAYS
  ).length;

  const missingDocumentCount = await db.careObligation.count({
    where: { journeyId, status: "OVERDUE", type: "PROVIDE_DOCUMENT" },
  });

  const referenceDate = lastEvent?.occurredAt ?? journey.createdAt;
  const inactivityDays = daysBetween(now, referenceDate);

  return {
    overdueCriticalObligationCount,
    missedAppointmentCount,
    unscheduledReferralCount,
    missingDocumentCount,
    // Not modeled in this MVP: there is no dedicated "contact attempt"
    // entity, so this signal is always 0 rather than fabricated. The risk
    // engine still accepts it so a future ContactAttempt model can feed it
    // in without changing the scoring logic.
    repeatedFailedContactCount: 0,
    inactivityDays,
    isJourneyBlocked: journey.state === "BLOCKED",
  };
}

export async function computeAndPersistRisk(
  patientId: string,
  journeyId: string,
  weights: RiskWeights = DEFAULT_RISK_WEIGHTS
) {
  const signals = await extractRiskSignals(patientId, journeyId);
  const result = computeContinuityRisk(signals, weights);

  await db.riskAssessment.create({
    data: {
      patientId,
      journeyId,
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      factors: JSON.stringify(result.factors),
    },
  });

  return result;
}

export async function getLatestRisk(patientId: string, journeyId?: string) {
  return db.riskAssessment.findFirst({
    where: journeyId ? { patientId, journeyId } : { patientId },
    orderBy: { computedAt: "desc" },
  });
}
