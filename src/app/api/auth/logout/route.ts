import { apiOk, apiError } from "@/lib/api-helpers";
import { clearSessionCookie } from "@/lib/auth";

export async function POST() {
  try {
    await clearSessionCookie();
    return apiOk({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
