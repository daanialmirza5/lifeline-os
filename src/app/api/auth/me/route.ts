import { apiOk } from "@/lib/api-helpers";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  return apiOk({ user: session });
}
