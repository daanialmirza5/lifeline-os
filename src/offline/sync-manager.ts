import { getQueuedOperations, updateOperationStatus, removeOperation, QueuedOperation } from "./db";

export interface SyncResult {
  operationId: string;
  syncStatus: "APPLIED" | "CONFLICT" | "REJECTED";
  conflict?: { local: unknown; server: unknown };
}

/**
 * Flushes every QUEUED operation to POST /api/sync in one batch. Each
 * operation carries a client-generated operationId, which the server
 * treats as an idempotency key (src/lib/services/sync.ts) — so calling
 * this repeatedly, including after a dropped response mid-flush, never
 * double-applies an operation.
 */
export async function flushQueue(): Promise<SyncResult[]> {
  const queued = await getQueuedOperations();
  if (queued.length === 0) return [];

  for (const op of queued) {
    await updateOperationStatus(op.operationId, "SYNCING");
  }

  let results: SyncResult[] = [];
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ operations: queued.map(toWirePayload) }),
    });
    if (!res.ok) throw new Error(`Sync request failed: ${res.status}`);
    const body = await res.json();
    results = body.results as SyncResult[];
  } catch {
    // Network failure mid-flush: leave operations QUEUED so the next
    // reconnect attempt retries them, incrementing retryCount for
    // observability.
    for (const op of queued) {
      await updateOperationStatus(op.operationId, "QUEUED", 1);
    }
    return [];
  }

  for (const result of results) {
    if (result.syncStatus === "APPLIED") {
      await removeOperation(result.operationId);
    } else {
      await updateOperationStatus(result.operationId, result.syncStatus);
    }
  }

  return results;
}

function toWirePayload(op: QueuedOperation) {
  return {
    operationId: op.operationId,
    entityType: op.entityType,
    entityId: op.entityId,
    operationType: op.operationType,
    payload: op.payload,
    baseVersion: op.baseVersion,
    createdAt: op.createdAt,
  };
}
