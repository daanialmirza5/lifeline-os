import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import { validateDocument, rejectDocument } from "@/lib/services/documents";

const bodySchema = z.object({
  action: z.enum(["VALIDATE", "REJECT"]),
  fields: z.record(z.string(), z.unknown()).optional(),
  reason: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(["CLINICIAN", "COORDINATOR", "ADMIN"]);
    const { id } = await params;
    const body = bodySchema.parse(await request.json());

    if (body.action === "REJECT") {
      const doc = await rejectDocument(id, body.reason ?? "Rejected during human review.", session);
      return apiOk({ document: doc });
    }

    const doc = await validateDocument(id, body.fields ?? {}, session);
    return apiOk({ document: doc });
  } catch (err) {
    return apiError(err);
  }
}
