import { apiError, apiOk } from "@/lib/api-helpers";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession();
    const { id } = await params;
    const obligations = await db.careObligation.findMany({
      where: { patientId: id },
      orderBy: { dueAt: "asc" },
      include: { assignedTo: { select: { name: true } } },
    });
    return apiOk({ obligations });
  } catch (err) {
    return apiError(err);
  }
}
