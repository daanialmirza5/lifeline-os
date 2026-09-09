import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-helpers";
import { requireSession } from "@/lib/auth";
import { syncOperationSchema } from "@/domain/schemas";
import { applySyncOperation } from "@/lib/services/sync";

const batchSchema = z.object({ operations: z.array(syncOperationSchema).max(100) });

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = batchSchema.parse(await request.json());

    const results = [];
    for (const op of body.operations) {
      const result = await applySyncOperation(op, session);
      results.push(result);
    }
    return apiOk({ results });
  } catch (err) {
    return apiError(err);
  }
}
