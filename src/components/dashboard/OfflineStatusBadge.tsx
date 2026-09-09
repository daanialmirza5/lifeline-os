"use client";

import { useOffline } from "@/offline/OfflineProvider";

export function OfflineStatusBadge() {
  const { isOnline, queuedCount, conflictCount } = useOffline();

  if (isOnline && queuedCount === 0 && conflictCount === 0) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--chart-good)]" aria-hidden />
        Online
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--risk-high)]">
      <span
        className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-[var(--risk-moderate)]" : "bg-[var(--risk-critical)]"}`}
        aria-hidden
      />
      {!isOnline
        ? `Offline${queuedCount > 0 ? ` — ${queuedCount} queued` : ""}`
        : conflictCount > 0
          ? `${conflictCount} sync conflict${conflictCount === 1 ? "" : "s"}`
          : `Syncing ${queuedCount}...`}
    </span>
  );
}
