import { apiError, apiOk } from "@/lib/api-helpers";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession();
    const { id } = await params;
    const type = new URL(request.url).searchParams.get("type");

    const events = await db.careEvent.findMany({
      where: { patientId: id, ...(type ? { type } : {}) },
      orderBy: { occurredAt: "desc" },
    });
    return apiOk({ events });
  } catch (err) {
    return apiError(err);
  }
}
