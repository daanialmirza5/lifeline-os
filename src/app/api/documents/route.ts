import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import { uploadDocument } from "@/lib/services/documents";
import { requirePatientAccess } from "@/lib/authorization";
import { db } from "@/lib/db";

const bodySchema = z.object({
  patientId: z.string().min(1),
  journeyId: z.string().optional(),
  filename: z.string().min(1).max(300),
  rawText: z.string().min(1).max(20000),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(["CLINICIAN", "COORDINATOR", "ADMIN"]);
    const patientId = new URL(request.url).searchParams.get("patientId") ?? undefined;
    // A request scoped to one patient is checked against that patient
    // directly; the unscoped cross-patient list (used by the Documents
    // review queue) is intentionally not filtered per-user — see the same
    // trade-off noted on listTasks in src/lib/services/tasks.ts.
    if (patientId) await requirePatientAccess(patientId, session);
    const documents = await db.document.findMany({
      where: patientId ? { patientId } : undefined,
      orderBy: { uploadedAt: "desc" },
      include: { patient: { select: { name: true } } },
    });
    return apiOk({ documents });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["CLINICIAN", "COORDINATOR", "ADMIN"]);
    const body = bodySchema.parse(await request.json());
    const result = await uploadDocument(body, session);
    return apiOk(result, 201);
  } catch (err) {
    return apiError(err);
  }
}
