"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authenticate, clearSessionCookie, requireRole, requireSession, setSessionCookie } from "@/lib/auth";
import { loginSchema, createReferralSchema, createAppointmentSchema } from "@/domain/schemas";
import { decideRecommendation } from "@/lib/services/recommendations";
import { updateTaskStatus } from "@/lib/services/tasks";
import { transitionJourney } from "@/lib/services/journeys";
import { createReferral, scheduleAppointment } from "@/lib/services/referrals";
import { uploadDocument, validateDocument, rejectDocument } from "@/lib/services/documents";
import { generateCommunicationDraft } from "@/lib/services/recommendations";
import { resolveConflict } from "@/lib/services/sync";
import { JourneyState, TaskStatus } from "@/domain/types";

export interface ActionState {
  error?: string;
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and password." };

  try {
    const session = await authenticate(parsed.data.email, parsed.data.password);
    await setSessionCookie(session);
  } catch {
    return { error: "Invalid email or password." };
  }
  redirect("/");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

export async function approveRecommendationAction(
  recommendationId: string,
  notes: string | undefined,
  editedRecommendation: string | undefined,
  redirectTo: string
) {
  const session = await requireRole(["CLINICIAN", "COORDINATOR", "ADMIN"]);
  await decideRecommendation(
    recommendationId,
    editedRecommendation ? "EDITED" : "APPROVED",
    session,
    notes,
    editedRecommendation
  );
  revalidatePath(redirectTo);
}

export async function rejectRecommendationAction(recommendationId: string, notes: string | undefined, redirectTo: string) {
  const session = await requireRole(["CLINICIAN", "COORDINATOR", "ADMIN"]);
  await decideRecommendation(recommendationId, "REJECTED", session, notes);
  revalidatePath(redirectTo);
}

export async function updateTaskStatusAction(
  taskId: string,
  status: TaskStatus,
  version: number,
  redirectTo: string
) {
  const session = await requireSession();
  await updateTaskStatus(taskId, status, version, session);
  revalidatePath(redirectTo);
}

export async function transitionJourneyAction(journeyId: string, to: JourneyState, redirectTo: string) {
  const session = await requireRole(["CLINICIAN", "COORDINATOR", "ADMIN"]);
  await transitionJourney(journeyId, to, session);
  revalidatePath(redirectTo);
}

export async function createReferralAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireRole(["CLINICIAN", "COORDINATOR", "ADMIN"]);
  const parsed = createReferralSchema.safeParse({
    patientId: formData.get("patientId"),
    journeyId: formData.get("journeyId"),
    specialty: formData.get("specialty"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid referral." };

  await createReferral(parsed.data, session);
  revalidatePath(`/patients/${parsed.data.patientId}`);
  redirect(`/patients/${parsed.data.patientId}`);
}

export async function scheduleAppointmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireRole(["CLINICIAN", "COORDINATOR", "ADMIN"]);
  const parsed = createAppointmentSchema.safeParse({
    patientId: formData.get("patientId"),
    journeyId: formData.get("journeyId"),
    referralId: formData.get("referralId") || undefined,
    type: formData.get("type"),
    provider: formData.get("provider"),
    scheduledAt: formData.get("scheduledAt"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid appointment." };

  await scheduleAppointment(parsed.data, session);
  revalidatePath(`/patients/${parsed.data.patientId}`);
  redirect(`/patients/${parsed.data.patientId}`);
}

export async function uploadDocumentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireRole(["CLINICIAN", "COORDINATOR", "ADMIN"]);
  const patientId = formData.get("patientId") as string;
  const journeyId = (formData.get("journeyId") as string) || undefined;
  const filename = formData.get("filename") as string;
  const rawText = formData.get("rawText") as string;
  if (!patientId || !filename || !rawText) return { error: "Patient, filename, and document text are required." };

  await uploadDocument({ patientId, journeyId, filename, rawText }, session);
  revalidatePath("/documents");
  return {};
}

export async function validateDocumentAction(documentId: string, fields: Record<string, unknown>) {
  const session = await requireRole(["CLINICIAN", "COORDINATOR", "ADMIN"]);
  await validateDocument(documentId, fields, session);
  revalidatePath("/documents");
}

export async function rejectDocumentAction(documentId: string, reason: string) {
  const session = await requireRole(["CLINICIAN", "COORDINATOR", "ADMIN"]);
  await rejectDocument(documentId, reason, session);
  revalidatePath("/documents");
}

export async function resolveConflictAction(
  operationId: string,
  resolution: "KEEP_SERVER" | "APPLY_LOCAL"
) {
  const session = await requireSession();
  await resolveConflict(operationId, resolution, session);
  revalidatePath("/tasks");
}

export async function generateCommunicationDraftAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRole(["CLINICIAN", "COORDINATOR", "ADMIN"]);
  const patientId = formData.get("patientId") as string;
  const patientName = formData.get("patientName") as string;
  const purpose = formData.get("purpose") as string;
  if (!patientId || !purpose) return { error: "Patient and purpose are required." };

  await generateCommunicationDraft(patientId, patientName, purpose);
  revalidatePath("/recommendations");
  revalidatePath("/approvals");
  return {};
}
