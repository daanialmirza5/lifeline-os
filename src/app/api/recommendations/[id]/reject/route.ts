import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import { z } from "zod";
import { decideRecommendation } from "@/lib/services/recommendations";

const bodySchema = z.object({ notes: z.string().max(2000).optional() });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(["CLINICIAN", "COORDINATOR", "ADMIN"]);
    const { id } = await params;
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const decided = await decideRecommendation(id, "REJECTED", session, body.notes);
    return apiOk({ recommendation: decided });
  } catch (err) {
    return apiError(err);
  }
}
