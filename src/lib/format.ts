/**
 * Deterministic date formatting pinned to a fixed locale/timezone-agnostic
 * format. Client components in this app are server-rendered first, then
 * hydrated in the browser — `toLocaleString()` with no arguments resolves
 * the *runtime's default locale*, which differs between Node (server) and
 * the browser, producing a React hydration mismatch. Pinning "en-US" with
 * explicit options makes server and client output byte-identical.
 */
export function formatDateTime(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDate(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function formatTime(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}
