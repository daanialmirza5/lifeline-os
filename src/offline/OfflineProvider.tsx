"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { enqueueOperation, getAllOperations, QueuedOperation } from "./db";
import { flushQueue } from "./sync-manager";

interface OfflineContextValue {
  isOnline: boolean;
  queuedCount: number;
  conflictCount: number;
  operations: QueuedOperation[];
  queueTaskUpdate: (params: {
    taskId: string;
    operationType: "ACKNOWLEDGE" | "UPDATE_STATUS";
    payload: Record<string, unknown>;
    baseVersion: number;
  }) => Promise<void>;
  syncNow: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue | null>(null);

function subscribeToConnectivity(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/**
 * navigator.onLine is a browser-only API: the server has no notion of it,
 * and the real client value can legitimately differ from whatever default
 * we'd guess during SSR. useSyncExternalStore is the React-sanctioned way
 * to read this kind of external, mutable browser state without a
 * hydration mismatch — it renders `getServerSnapshot()` through hydration
 * and only switches to the live value in a follow-up client render.
 */
function useIsOnline(): boolean {
  return useSyncExternalStore(
    subscribeToConnectivity,
    () => navigator.onLine,
    () => true
  );
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const isOnline = useIsOnline();
  const wasOnline = useRef(isOnline);
  const [operations, setOperations] = useState<QueuedOperation[]>([]);
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      setOperations(await getAllOperations());
    } catch {
      // IndexedDB unavailable (e.g. private browsing) — offline queueing
      // degrades to "unavailable" rather than crashing the app.
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (!navigator.onLine) return;
    await flushQueue();
    await refresh();
    router.refresh();
  }, [refresh, router]);

  useEffect(() => {
    // Initial load of any operations queued in a previous session — and if
    // we're already online with a non-empty queue (e.g. the browser was
    // closed while offline and never got a fresh "online" transition to
    // react to), flush it now rather than waiting for a transition that
    // may never come.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount from IndexedDB
    refresh().then(() => {
      if (navigator.onLine) syncNow();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only
  }, []);

  useEffect(() => {
    if (isOnline && !wasOnline.current) {
      // Just came back online — flush the queue.
      syncNow();
    }
    wasOnline.current = isOnline;
  }, [isOnline, syncNow]);

  const queueTaskUpdate = useCallback<OfflineContextValue["queueTaskUpdate"]>(
    async ({ taskId, operationType, payload, baseVersion }) => {
      await enqueueOperation({
        operationId: crypto.randomUUID(),
        entityType: "Task",
        entityId: taskId,
        operationType,
        payload,
        baseVersion,
        createdAt: new Date().toISOString(),
      });
      await refresh();
      if (navigator.onLine) await syncNow();
    },
    [refresh, syncNow]
  );

  const queuedCount = operations.filter((o) => o.syncStatus === "QUEUED" || o.syncStatus === "SYNCING").length;
  const conflictCount = operations.filter((o) => o.syncStatus === "CONFLICT").length;

  return (
    <OfflineContext.Provider value={{ isOnline, queuedCount, conflictCount, operations, queueTaskUpdate, syncNow }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used within OfflineProvider");
  return ctx;
}
