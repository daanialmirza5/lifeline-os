import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-helpers";
import { loginSchema } from "@/domain/schemas";
import { authenticate, setSessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = loginSchema.parse(await request.json());
    const session = await authenticate(body.email, body.password);
    await setSessionCookie(session);
    return apiOk({ user: session });
  } catch (err) {
    return apiError(err);
  }
}
