import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-helpers";
import { requireSession, requireRole } from "@/lib/auth";
import { createTaskSchema } from "@/domain/schemas";
import { createTask, listTasks } from "@/lib/services/tasks";
import { TaskStatus } from "@/domain/types";

export async function GET(request: NextRequest) {
  try {
    await requireSession();
    const status = new URL(request.url).searchParams.get("status") as TaskStatus | null;
    const tasks = await listTasks(status ? { status } : undefined);
    return apiOk({ tasks });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["CLINICIAN", "COORDINATOR", "ADMIN"]);
    const body = createTaskSchema.parse(await request.json());
    const task = await createTask(body, session);
    return apiOk({ task }, 201);
  } catch (err) {
    return apiError(err);
  }
}
