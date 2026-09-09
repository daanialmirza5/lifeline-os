import { CareEventType, Priority } from "./types";

/**
 * Deterministic rules mapping a care event to the obligation(s) it creates.
 * This is the "what must happen next" logic (spec section 10) — plain
 * rules, not an LLM call, so it is predictable and unit-testable.
 */

export interface ObligationTemplate {
  type: string;
  description: string;
  priority: Priority;
  dueInDays: number;
}

export interface EventForObligationRules {
  type: CareEventType;
  metadata?: Record<string, unknown> | null;
}

const RULES: Partial<Record<CareEventType, (event: EventForObligationRules) => ObligationTemplate[]>> = {
  REFERRAL: () => [
    {
      type: "SCHEDULE_SPECIALIST_APPOINTMENT",
      description: "Specialist appointment must be scheduled following this referral.",
      priority: "HIGH",
      dueInDays: 7,
    },
  ],
  LAB_ORDER: () => [
    {
      type: "COMPLETE_LAB_TEST",
      description: "Patient must complete the ordered lab test.",
      priority: "MEDIUM",
      dueInDays: 5,
    },
  ],
  LAB_RESULT: () => [
    {
      type: "REVIEW_LAB_RESULT",
      description: "Clinician must review the lab result and update the care plan.",
      priority: "MEDIUM",
      dueInDays: 3,
    },
  ],
  CARE_PLAN: () => [
    {
      type: "INITIATE_CARE_PLAN",
      description: "Care plan actions (medication, monitoring) must be initiated.",
      priority: "MEDIUM",
      dueInDays: 5,
    },
  ],
  CONSULTATION: (event) => {
    if (event.metadata?.followUpRequired) {
      return [
        {
          type: "SCHEDULE_FOLLOW_UP",
          description: "Follow-up appointment must be scheduled per consultation notes.",
          priority: "MEDIUM",
          dueInDays: 14,
        },
      ];
    }
    return [];
  },
  MEDICATION: () => [
    {
      type: "MEDICATION_ADHERENCE_CHECKIN",
      description: "Coordinator should confirm medication adherence.",
      priority: "LOW",
      dueInDays: 30,
    },
  ],
};

export function deriveObligationsForEvent(
  event: EventForObligationRules
): ObligationTemplate[] {
  const rule = RULES[event.type];
  return rule ? rule(event) : [];
}
