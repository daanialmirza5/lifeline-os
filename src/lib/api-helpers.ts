import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError } from "@/domain/errors";

/**
 * Uniform error shape for every API route (spec section 55):
 * { error: { code, message } }. DomainError subclasses carry their own
 * status/code; anything else becomes a generic 500 without leaking
 * internal detail to the client.
 */
export function apiError(err: unknown): NextResponse {
  if (err instanceof DomainError) {
    return NextResponse.json(err.toJSON(), { status: err.status });
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: err.issues.map((i) => i.message).join("; ") } },
      { status: 422 }
    );
  }
  console.error("[api] unhandled error", err);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
    { status: 500 }
  );
}

export function apiOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}
