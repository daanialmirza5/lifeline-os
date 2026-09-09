import { describe, it, expect } from "vitest";
import { validateJourneyTransition } from "@/domain/workflow";
import { InvalidTransitionError } from "@/domain/errors";
import { JOURNEY_STATES, TERMINAL_JOURNEY_STATES, JourneyState } from "@/domain/types";

describe("workflow: validateJourneyTransition", () => {
  it("accepts a valid transition", () => {
    expect(validateJourneyTransition("CREATED", "ACTIVE")).toEqual({ from: "CREATED", to: "ACTIVE" });
    expect(validateJourneyTransition("ACTIVE", "ACTION_REQUIRED")).toEqual({
      from: "ACTIVE",
      to: "ACTION_REQUIRED",
    });
  });

  it("rejects an invalid (out-of-order) transition", () => {
    expect(() => validateJourneyTransition("CREATED", "COMPLETED")).toThrow(InvalidTransitionError);
  });

  it("rejects a duplicate (no-op) transition", () => {
    expect(() => validateJourneyTransition("ACTIVE", "ACTIVE")).toThrow(InvalidTransitionError);
  });

  for (const terminal of TERMINAL_JOURNEY_STATES) {
    it(`rejects any transition out of the terminal state ${terminal}`, () => {
      for (const target of JOURNEY_STATES as readonly JourneyState[]) {
        if (target === terminal) continue;
        expect(() => validateJourneyTransition(terminal, target)).toThrow(InvalidTransitionError);
      }
    });
  }

  it("rejects concurrent-looking double transitions the same way a duplicate would be rejected", () => {
    // Simulates two callers racing to apply the same transition: the
    // first succeeds, the second (with 'from' already advanced) is a
    // duplicate and must be rejected, not silently coerced.
    const first = validateJourneyTransition("ACTIVE", "BLOCKED");
    expect(first.to).toBe("BLOCKED");
    expect(() => validateJourneyTransition("BLOCKED", "BLOCKED")).toThrow(InvalidTransitionError);
  });

  it("allows recovery from BLOCKED back to ACTIVE", () => {
    expect(validateJourneyTransition("BLOCKED", "ACTIVE")).toEqual({ from: "BLOCKED", to: "ACTIVE" });
  });

  it("allows escalation and de-escalation", () => {
    expect(validateJourneyTransition("ACTION_REQUIRED", "ESCALATED").to).toBe("ESCALATED");
    expect(validateJourneyTransition("ESCALATED", "ACTIVE").to).toBe("ACTIVE");
  });
});
