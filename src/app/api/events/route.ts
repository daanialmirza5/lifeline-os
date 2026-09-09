import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import { createCareEventSchema } from "@/domain/schemas";
import { createCareEvent } from "@/lib/services/events";

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["CLINICIAN", "COORDINATOR", "ADMIN"]);
    const body = createCareEventSchema.parse(await request.json());
    const result = await createCareEvent(body, session);
    return apiOk(result, 201);
  } catch (err) {
    return apiError(err);
  }
}
