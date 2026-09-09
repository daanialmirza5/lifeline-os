import { db } from "@/lib/db";

export interface AttentionItem {
  patientId: string;
  patientName: string;
  riskLevel: string;
  riskScore: number;
  reason: string;
  evidence: string[];
  recommendedAction: string;
  owner: string;
  approvalState: string;
}

/**
 * "What needs attention now" — a global, prioritized queue built entirely
 * from stored RiskAssessment + AIRecommendation rows (spec section 52).
 * Every item traces back to real data: no numbers here are invented.
 */
export async function getAttentionQueue(): Promise<AttentionItem[]> {
  const patients = await db.patient.findMany({
    include: {
      riskAssessments: { orderBy: { computedAt: "desc" }, take: 1 },
      recommendations: {
        where: { status: "SUGGESTED" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const items: AttentionItem[] = [];
  for (const patient of patients) {
    const risk = patient.riskAssessments[0];
    if (!risk || (risk.riskLevel !== "HIGH" && risk.riskLevel !== "CRITICAL")) continue;

    const factors: { factor: string; weight: number }[] = JSON.parse(risk.factors);
    const topFactor = factors.sort((a, b) => b.weight - a.weight)[0];
    const recommendation = patient.recommendations[0];

    items.push({
      patientId: patient.id,
      patientName: patient.name,
      riskLevel: risk.riskLevel,
      riskScore: risk.riskScore,
      reason: topFactor?.factor ?? "Elevated continuity risk",
      evidence: factors.map((f) => `${f.factor} (+${f.weight})`),
      recommendedAction: recommendation?.recommendation ?? "Clinical/coordinator review recommended.",
      owner: recommendation ? "Coordinator (pending approval)" : "Unassigned",
      approvalState: recommendation ? "Awaiting approval" : "No recommendation yet",
    });
  }

  return items.sort((a, b) => b.riskScore - a.riskScore);
}

async function getLatestRiskLevelPerPatient(): Promise<string[]> {
  const groups = await db.riskAssessment.groupBy({ by: ["patientId"], _max: { computedAt: true } });
  const latest = await Promise.all(
    groups.map((g) =>
      db.riskAssessment.findFirst({ where: { patientId: g.patientId, computedAt: g._max.computedAt! } })
    )
  );
  return latest.filter((r): r is NonNullable<typeof r> => r !== null).map((r) => r.riskLevel);
}

export async function getDashboardCounts() {
  const [activePatients, overdueObligations, pendingReferrals, upcomingAppointments, pendingApprovals, riskLevels] =
    await Promise.all([
      db.patient.count(),
      db.careObligation.count({ where: { status: "OVERDUE" } }),
      db.referral.count({ where: { status: "PENDING" } }),
      db.appointment.count({ where: { status: "SCHEDULED", scheduledAt: { gte: new Date() } } }),
      db.aIRecommendation.count({ where: { status: "SUGGESTED" } }),
      getLatestRiskLevelPerPatient(),
    ]);

  const riskDistribution = { CRITICAL: 0, HIGH: 0, MODERATE: 0, LOW: 0 };
  for (const level of riskLevels) {
    if (level in riskDistribution) riskDistribution[level as keyof typeof riskDistribution]++;
  }

  return {
    activePatients,
    overdueObligations,
    pendingReferrals,
    upcomingAppointments,
    pendingApprovals,
    riskDistribution,
  };
}
