import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    await requireRole(["CLINICIAN", "COORDINATOR", "ADMIN"]);
    const url = new URL(request.url);
    const entityType = url.searchParams.get("entityType") ?? undefined;
    const entityId = url.searchParams.get("entityId") ?? undefined;
    const take = Math.min(Number(url.searchParams.get("take") ?? 100), 500);

    const events = await db.auditEvent.findMany({
      where: { ...(entityType ? { entityType } : {}), ...(entityId ? { entityId } : {}) },
      orderBy: { createdAt: "desc" },
      take,
      include: { actor: { select: { name: true, role: true } } },
    });
    return apiOk({ events });
  } catch (err) {
    return apiError(err);
  }
}
