import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import { createReferralSchema } from "@/domain/schemas";
import { createReferral } from "@/lib/services/referrals";

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["CLINICIAN", "COORDINATOR", "ADMIN"]);
    const body = createReferralSchema.parse(await request.json());
    const referral = await createReferral(body, session);
    return apiOk({ referral }, 201);
  } catch (err) {
    return apiError(err);
  }
}
