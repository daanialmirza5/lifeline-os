import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-helpers";
import { requireSession } from "@/lib/auth";
import { updateTaskSchema } from "@/domain/schemas";
import { updateTaskStatus } from "@/lib/services/tasks";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = updateTaskSchema.parse(await request.json());
    const task = await updateTaskStatus(id, body.status, body.version, session);
    return apiOk({ task });
  } catch (err) {
    return apiError(err);
  }
}
