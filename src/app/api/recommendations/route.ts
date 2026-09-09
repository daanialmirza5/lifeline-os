import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-helpers";
import { requireSession } from "@/lib/auth";
import { listRecommendationQueue } from "@/lib/services/recommendations";

export async function GET(request: NextRequest) {
  try {
    await requireSession();
    const status = new URL(request.url).searchParams.get("status") ?? undefined;
    const recommendations = await listRecommendationQueue(status);
    return apiOk({
      recommendations: recommendations.map((r) => ({ ...r, evidence: JSON.parse(r.evidence) })),
    });
  } catch (err) {
    return apiError(err);
  }
}
