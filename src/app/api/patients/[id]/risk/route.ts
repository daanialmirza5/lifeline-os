import { apiError, apiOk } from "@/lib/api-helpers";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLatestRisk, computeAndPersistRisk } from "@/lib/services/risk";
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

/** Recomputes risk on demand (e.g. "refresh" button in the UI). */
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
    return apiOk({ risk: result });
  } catch (err) {
    return apiError(err);
  }
}
