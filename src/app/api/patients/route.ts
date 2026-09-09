import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-helpers";
import { requireSession } from "@/lib/auth";
import { listPatients, createPatient } from "@/lib/services/patients";
import { createJourney } from "@/lib/services/journeys";
import { createPatientSchema } from "@/domain/schemas";
import { ForbiddenError } from "@/domain/errors";

export async function GET() {
  try {
    await requireSession();
    const patients = await listPatients();
    return apiOk({ patients });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!["CLINICIAN", "COORDINATOR", "ADMIN"].includes(session.role)) {
      throw new ForbiddenError();
    }
    const body = createPatientSchema.parse(await request.json());
    const patient = await createPatient(body);
    const journey = await createJourney(patient.id, "Primary Care Journey");
    return apiOk({ patient, journey }, 201);
  } catch (err) {
    return apiError(err);
  }
}
