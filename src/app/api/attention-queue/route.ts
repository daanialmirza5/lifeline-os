import { apiError, apiOk } from "@/lib/api-helpers";
import { requireSession } from "@/lib/auth";
import { getAttentionQueue } from "@/lib/services/dashboard";

export async function GET() {
  try {
    await requireSession();
    const items = await getAttentionQueue();
    return apiOk({ items });
  } catch (err) {
    return apiError(err);
  }
}
