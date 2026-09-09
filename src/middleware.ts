import { NextRequest, NextResponse } from "next/server";

/**
 * In-memory, per-instance rate limiter and baseline security headers.
 * The in-memory limiter is a known prototype limitation — it resets on
 * restart and doesn't coordinate across multiple server instances; a real
 * deployment should move this to Redis (see docs/security.md).
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 120;
const buckets = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > MAX_REQUESTS_PER_WINDOW;
}

// Cheap unbounded-growth guard for the in-memory map, since this is not a
// production rate limiter.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > WINDOW_MS) buckets.delete(key);
  }
}, WINDOW_MS).unref?.();

export function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests. Please slow down." } },
        { status: 429, headers: { "x-request-id": requestId } }
      );
    }
  }

  const response = NextResponse.next();
  response.headers.set("x-request-id", requestId);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
