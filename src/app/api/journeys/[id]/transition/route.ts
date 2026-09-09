import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import { transitionJourneySchema } from "@/domain/schemas";
import { transitionJourney } from "@/lib/services/journeys";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(["CLINICIAN", "COORDINATOR", "ADMIN"]);
    const { id } = await params;
    const body = transitionJourneySchema.parse(await request.json());
    const journey = await transitionJourney(id, body.to, session, body.reason);
    return apiOk({ journey });
  } catch (err) {
    return apiError(err);
  }
}
