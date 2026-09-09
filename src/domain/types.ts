// Canonical enum-like constants for the Lifeline OS domain.
//
// These back plain `String` columns in prisma/schema.prisma (SQLite has no
// native enum type). Every value written to the database must come from one
// of these sets — validated at the service boundary via src/domain/schemas.ts.

export const ROLES = ["PATIENT", "CLINICIAN", "COORDINATOR", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const JOURNEY_STATES = [
  "CREATED",
  "ACTIVE",
  "ACTION_REQUIRED",
  "IN_PROGRESS",
  "BLOCKED",
  "ESCALATED",
  "COMPLETED",
  "CANCELLED",
] as const;
export type JourneyState = (typeof JOURNEY_STATES)[number];

export const TERMINAL_JOURNEY_STATES: JourneyState[] = ["COMPLETED", "CANCELLED"];

// Valid state machine transitions. Anything not listed here is rejected.
export const JOURNEY_TRANSITIONS: Record<JourneyState, JourneyState[]> = {
  CREATED: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["ACTION_REQUIRED", "BLOCKED", "COMPLETED", "CANCELLED"],
  ACTION_REQUIRED: ["IN_PROGRESS", "ESCALATED", "BLOCKED", "CANCELLED"],
  IN_PROGRESS: ["ACTIVE", "COMPLETED", "BLOCKED", "CANCELLED"],
  BLOCKED: ["ACTIVE", "ESCALATED", "CANCELLED"],
  ESCALATED: ["ACTIVE", "BLOCKED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const CARE_EVENT_TYPES = [
  "CONSULTATION",
  "LAB_ORDER",
  "LAB_RESULT",
  "CARE_PLAN",
  "REFERRAL",
  "APPOINTMENT",
  "MEDICATION",
  "FOLLOW_UP",
  "DOCUMENT",
  "TASK",
  "AI_EVENT",
] as const;
export type CareEventType = (typeof CARE_EVENT_TYPES)[number];

export const CARE_EVENT_STATUSES = [
  "COMPLETED",
  "ACTIVE",
  "PENDING",
  "OVERDUE",
  "BLOCKED",
  "CANCELLED",
  "FAILED",
  "REQUIRES_APPROVAL",
] as const;
export type CareEventStatus = (typeof CARE_EVENT_STATUSES)[number];

export const OBLIGATION_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "OVERDUE",
  "CANCELLED",
  "ESCALATED",
] as const;
export type ObligationStatus = (typeof OBLIGATION_STATUSES)[number];

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const REFERRAL_STATUSES = ["PENDING", "SCHEDULED", "COMPLETED", "CANCELLED"] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

export const APPOINTMENT_STATUSES = ["SCHEDULED", "COMPLETED", "MISSED", "CANCELLED"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const TASK_STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const DOCUMENT_STATUSES = ["UPLOADED", "EXTRACTED", "VALIDATED", "REJECTED"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const RISK_LEVELS = ["LOW", "MODERATE", "HIGH", "CRITICAL"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const AGENT_TYPES = [
  "TIMELINE",
  "CONTINUITY",
  "RISK_EXPLANATION",
  "COORDINATION",
  "COMMUNICATION",
  "CLINICAL_SUMMARY",
] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

export const RECOMMENDATION_STATUSES = [
  "SUGGESTED",
  "APPROVED",
  "REJECTED",
  "EDITED",
  "EXECUTED",
] as const;
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

export const SYNC_STATUSES = ["PENDING", "APPLIED", "CONFLICT", "REJECTED"] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export function isValidJourneyTransition(from: JourneyState, to: JourneyState): boolean {
  return JOURNEY_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminalJourneyState(state: JourneyState): boolean {
  return TERMINAL_JOURNEY_STATES.includes(state);
}
