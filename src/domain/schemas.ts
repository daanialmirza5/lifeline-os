import { z } from "zod";
import {
  AGENT_TYPES,
  APPOINTMENT_STATUSES,
  CARE_EVENT_STATUSES,
  CARE_EVENT_TYPES,
  DOCUMENT_STATUSES,
  JOURNEY_STATES,
  OBLIGATION_STATUSES,
  PRIORITIES,
  RECOMMENDATION_STATUSES,
  REFERRAL_STATUSES,
  RISK_LEVELS,
  ROLES,
  TASK_STATUSES,
} from "./types";

export const roleSchema = z.enum(ROLES);
export const journeyStateSchema = z.enum(JOURNEY_STATES);
export const careEventTypeSchema = z.enum(CARE_EVENT_TYPES);
export const careEventStatusSchema = z.enum(CARE_EVENT_STATUSES);
export const obligationStatusSchema = z.enum(OBLIGATION_STATUSES);
export const prioritySchema = z.enum(PRIORITIES);
export const referralStatusSchema = z.enum(REFERRAL_STATUSES);
export const appointmentStatusSchema = z.enum(APPOINTMENT_STATUSES);
export const taskStatusSchema = z.enum(TASK_STATUSES);
export const documentStatusSchema = z.enum(DOCUMENT_STATUSES);
export const riskLevelSchema = z.enum(RISK_LEVELS);
export const agentTypeSchema = z.enum(AGENT_TYPES);
export const recommendationStatusSchema = z.enum(RECOMMENDATION_STATUSES);

export const createPatientSchema = z.object({
  name: z.string().min(1).max(200),
  dob: z.coerce.date(),
  mrn: z.string().min(1).max(50).optional(),
});

export const createCareEventSchema = z.object({
  patientId: z.string().min(1),
  journeyId: z.string().min(1),
  type: careEventTypeSchema,
  status: careEventStatusSchema.default("COMPLETED"),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  occurredAt: z.coerce.date().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const createReferralSchema = z.object({
  patientId: z.string().min(1),
  journeyId: z.string().min(1),
  specialty: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
});

export const createAppointmentSchema = z.object({
  patientId: z.string().min(1),
  journeyId: z.string().min(1),
  referralId: z.string().optional(),
  type: z.string().min(1).max(200),
  provider: z.string().min(1).max(200),
  scheduledAt: z.coerce.date(),
});

export const createTaskSchema = z.object({
  patientId: z.string().min(1),
  journeyId: z.string().min(1),
  obligationId: z.string().optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  assignedToId: z.string().optional(),
  assignedRole: roleSchema.optional(),
  priority: prioritySchema.default("MEDIUM"),
  dueAt: z.coerce.date().optional(),
});

export const updateTaskSchema = z.object({
  status: taskStatusSchema,
  version: z.number().int().positive(),
});

export const transitionJourneySchema = z.object({
  to: journeyStateSchema,
  reason: z.string().max(1000).optional(),
});

export const recommendationDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED", "EDITED"]),
  notes: z.string().max(2000).optional(),
  editedRecommendation: z.string().max(2000).optional(),
});

export const syncOperationSchema = z.object({
  operationId: z.string().min(1),
  entityType: z.enum(["Task", "CareObligation", "Document"]),
  entityId: z.string().min(1),
  operationType: z.enum(["ACKNOWLEDGE", "UPDATE_STATUS", "ADD_NOTE"]),
  payload: z.record(z.string(), z.unknown()),
  baseVersion: z.number().int().positive().optional(),
  createdAt: z.coerce.date(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
