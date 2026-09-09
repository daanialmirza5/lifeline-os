import { openDB, DBSchema, IDBPDatabase } from "idb";

export interface QueuedOperation {
  operationId: string;
  entityType: "Task";
  entityId: string;
  operationType: "ACKNOWLEDGE" | "UPDATE_STATUS";
  payload: Record<string, unknown>;
  baseVersion: number;
  createdAt: string;
  retryCount: number;
  syncStatus: "QUEUED" | "SYNCING" | "SYNCED" | "CONFLICT" | "REJECTED";
}

interface LifelineOfflineDB extends DBSchema {
  syncQueue: {
    key: string;
    value: QueuedOperation;
    indexes: { "by-status": string };
  };
}

let dbPromise: Promise<IDBPDatabase<LifelineOfflineDB>> | null = null;

function getDb() {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment.");
  }
  if (!dbPromise) {
    dbPromise = openDB<LifelineOfflineDB>("lifeline-offline", 1, {
      upgrade(db) {
        const store = db.createObjectStore("syncQueue", { keyPath: "operationId" });
        store.createIndex("by-status", "syncStatus");
      },
    });
  }
  return dbPromise;
}

export async function enqueueOperation(op: Omit<QueuedOperation, "retryCount" | "syncStatus">) {
  const db = await getDb();
  await db.put("syncQueue", { ...op, retryCount: 0, syncStatus: "QUEUED" });
}

export async function getAllOperations(): Promise<QueuedOperation[]> {
  const db = await getDb();
  return db.getAll("syncQueue");
}

export async function getQueuedOperations(): Promise<QueuedOperation[]> {
  const db = await getDb();
  return db.getAllFromIndex("syncQueue", "by-status", "QUEUED");
}

export async function updateOperationStatus(
  operationId: string,
  syncStatus: QueuedOperation["syncStatus"],
  retryCountDelta = 0
) {
  const db = await getDb();
  const existing = await db.get("syncQueue", operationId);
  if (!existing) return;
  await db.put("syncQueue", {
    ...existing,
    syncStatus,
    retryCount: existing.retryCount + retryCountDelta,
  });
}

export async function removeOperation(operationId: string) {
  const db = await getDb();
  await db.delete("syncQueue", operationId);
}
