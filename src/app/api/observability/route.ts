import { apiError, apiOk } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import { getRecentAIEvents } from "@/ai/orchestrator";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await requireRole(["ADMIN"]);
    const [pendingSync, recentAudit] = await Promise.all([
      db.syncOperation.count({ where: { syncStatus: { in: ["PENDING", "CONFLICT"] } } }),
      db.auditEvent.count(),
    ]);
    return apiOk({
      aiEvents: getRecentAIEvents(),
      queueStatus: { pendingOrConflictedSyncOps: pendingSync },
      totalAuditEvents: recentAudit,
    });
  } catch (err) {
    return apiError(err);
  }
}
