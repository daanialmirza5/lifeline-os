import { apiError, apiOk } from "@/lib/api-helpers";
import { requireSession } from "@/lib/auth";
import { getPatientDetail } from "@/lib/services/patients";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession();
    const { id } = await params;
    const patient = await getPatientDetail(id);
    return apiOk({ patient });
  } catch (err) {
    return apiError(err);
  }
}
