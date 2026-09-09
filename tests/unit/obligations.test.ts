import { describe, it, expect } from "vitest";
import { deriveObligationsForEvent } from "@/domain/obligations";

describe("obligations: deriveObligationsForEvent", () => {
  it("derives a specialist-appointment obligation from a REFERRAL event", () => {
    const obligations = deriveObligationsForEvent({ type: "REFERRAL" });
    expect(obligations).toHaveLength(1);
    expect(obligations[0].type).toBe("SCHEDULE_SPECIALIST_APPOINTMENT");
    expect(obligations[0].priority).toBe("HIGH");
  });

  it("derives a lab-completion obligation from a LAB_ORDER event", () => {
    const obligations = deriveObligationsForEvent({ type: "LAB_ORDER" });
    expect(obligations[0].type).toBe("COMPLETE_LAB_TEST");
  });

  it("derives no obligation from a CONSULTATION without follow-up metadata", () => {
    expect(deriveObligationsForEvent({ type: "CONSULTATION" })).toEqual([]);
    expect(deriveObligationsForEvent({ type: "CONSULTATION", metadata: {} })).toEqual([]);
  });

  it("derives a follow-up obligation from a CONSULTATION with followUpRequired metadata", () => {
    const obligations = deriveObligationsForEvent({
      type: "CONSULTATION",
      metadata: { followUpRequired: true },
    });
    expect(obligations).toHaveLength(1);
    expect(obligations[0].type).toBe("SCHEDULE_FOLLOW_UP");
  });

  it("derives no obligation for event types with no rule (APPOINTMENT, FOLLOW_UP, DOCUMENT, TASK, AI_EVENT)", () => {
    for (const type of ["APPOINTMENT", "FOLLOW_UP", "DOCUMENT", "TASK", "AI_EVENT"] as const) {
      expect(deriveObligationsForEvent({ type })).toEqual([]);
    }
  });

  it("every derived obligation has a positive due-in-days window", () => {
    for (const type of ["REFERRAL", "LAB_ORDER", "LAB_RESULT", "CARE_PLAN", "MEDICATION"] as const) {
      for (const o of deriveObligationsForEvent({ type })) {
        expect(o.dueInDays).toBeGreaterThan(0);
      }
    }
  });
});
