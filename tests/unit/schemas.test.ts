import { describe, it, expect } from "vitest";
import { createCareEventSchema, createTaskSchema, transitionJourneySchema, loginSchema } from "@/domain/schemas";

describe("domain/schemas: input validation", () => {
  it("accepts a well-formed care event", () => {
    const result = createCareEventSchema.safeParse({
      patientId: "p1",
      journeyId: "j1",
      type: "CONSULTATION",
      title: "Initial visit",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a care event with an invalid type", () => {
    const result = createCareEventSchema.safeParse({
      patientId: "p1",
      journeyId: "j1",
      type: "NOT_A_REAL_TYPE",
      title: "Initial visit",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a care event missing a required field", () => {
    const result = createCareEventSchema.safeParse({ journeyId: "j1", type: "CONSULTATION", title: "x" });
    expect(result.success).toBe(false);
  });

  it("rejects a task with an invalid priority", () => {
    const result = createTaskSchema.safeParse({
      patientId: "p1",
      journeyId: "j1",
      title: "Do something",
      priority: "SUPER_URGENT",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown journey transition target", () => {
    const result = transitionJourneySchema.safeParse({ to: "SOMEWHERE_INVALID" });
    expect(result.success).toBe(false);
  });

  it("rejects a login with a malformed email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "x" });
    expect(result.success).toBe(false);
  });

  it("rejects a login with an empty password", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "" });
    expect(result.success).toBe(false);
  });
});
