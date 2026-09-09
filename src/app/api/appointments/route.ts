import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import { createAppointmentSchema } from "@/domain/schemas";
import { scheduleAppointment } from "@/lib/services/referrals";

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["CLINICIAN", "COORDINATOR", "ADMIN"]);
    const body = createAppointmentSchema.parse(await request.json());
    const appointment = await scheduleAppointment(body, session);
    return apiOk({ appointment }, 201);
  } catch (err) {
    return apiError(err);
  }
}
