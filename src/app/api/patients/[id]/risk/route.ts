import { apiError, apiOk } from "@/lib/api-helpers";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLatestRisk, computeAndPersistRisk } from "@/lib/services/risk";
import {
  generateCoordinationRecommendations,
  generateRiskExplanationRecommendation,
} from "@/lib/services/recommendations";
import { NotFoundError } from "@/domain/errors";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession();
    const { id } = await params;
    const risk = await getLatestRisk(id);
    return apiOk({ risk: risk ? { ...risk, factors: JSON.parse(risk.factors) } : null });
  } catch (err) {
    return apiError(err);
  }
}

/**
 * Recomputes risk on demand (e.g. "refresh" button in the UI), and — if
 * that recomputation surfaces active risk factors — generates fresh
 * coordination and risk-explanation recommendations for them. Generation
 * is idempotent per obligation (services/recommendations.ts skips any
 * obligation that already has a SUGGESTED recommendation), so repeatedly
 * hitting this endpoint doesn't spam duplicates.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession();
    const { id } = await params;
    const journey = await db.careJourney.findFirst({ where: { patientId: id }, orderBy: { createdAt: "desc" } });
    if (!journey) throw new NotFoundError("CareJourney for patient", id);

    const result = await computeAndPersistRisk(id, journey.id);

    if (result.factors.length > 0) {
      await generateCoordinationRecommendations(id, journey.id);
      await generateRiskExplanationRecommendation(id, journey.id, result.riskScore, result.riskLevel, result.factors);
    }

    return apiOk({ risk: result });
  } catch (err) {
    return apiError(err);
  }
}
