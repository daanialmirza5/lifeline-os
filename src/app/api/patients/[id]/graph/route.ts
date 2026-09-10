import { apiError, apiOk } from "@/lib/api-helpers";
import { requireSession } from "@/lib/auth";
import { requirePatientAccess } from "@/lib/authorization";
import { db } from "@/lib/db";
import { getJourneyWithGraph } from "@/lib/services/journeys";
import { NotFoundError } from "@/domain/errors";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    await requirePatientAccess(id, session);
    const journey = await db.careJourney.findFirst({
      where: { patientId: id },
      orderBy: { createdAt: "desc" },
    });
    if (!journey) throw new NotFoundError("CareJourney for patient", id);
    const graph = await getJourneyWithGraph(journey.id);
    return apiOk({ journey: graph });
  } catch (err) {
    return apiError(err);
  }
}
