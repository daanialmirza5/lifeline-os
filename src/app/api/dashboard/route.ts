import { apiError, apiOk } from "@/lib/api-helpers";
import { requireSession } from "@/lib/auth";
import { getDashboardCounts } from "@/lib/services/dashboard";

export async function GET() {
  try {
    await requireSession();
    const counts = await getDashboardCounts();
    return apiOk(counts);
  } catch (err) {
    return apiError(err);
  }
}
