import { db } from "@/lib/db";
import { recordAudit, newRequestId } from "@/lib/audit";
import { Session } from "@/lib/auth";
import { createCareEvent } from "./events";
import { NotFoundError } from "@/domain/errors";

export async function createReferral(
  input: { patientId: string; journeyId: string; specialty: string; notes?: string },
  actor: Session
) {
  const referral = await db.referral.create({
    data: {
      patientId: input.patientId,
      journeyId: input.journeyId,
      specialty: input.specialty,
      notes: input.notes ?? null,
      status: "PENDING",
      createdById: actor.userId,
    },
  });

  // Creating a referral is a care event in its own right, which is what
  // triggers the "schedule specialist appointment" obligation (see
  // src/domain/obligations.ts) and a risk recompute.
  await createCareEvent(
    {
      patientId: input.patientId,
      journeyId: input.journeyId,
      type: "REFERRAL",
      title: `Referral to ${input.specialty}`,
      description: input.notes,
      metadata: { referralId: referral.id },
    },
    actor
  );

  return referral;
}

export async function scheduleAppointment(
  input: {
    patientId: string;
    journeyId: string;
    referralId?: string;
    type: string;
    provider: string;
    scheduledAt: Date;
  },
  actor: Session
) {
  const appointment = await db.appointment.create({
    data: {
      patientId: input.patientId,
      journeyId: input.journeyId,
      referralId: input.referralId ?? null,
      type: input.type,
      provider: input.provider,
      scheduledAt: input.scheduledAt,
      status: "SCHEDULED",
    },
  });

  if (input.referralId) {
    const referral = await db.referral.findUnique({ where: { id: input.referralId } });
    if (!referral) throw new NotFoundError("Referral", input.referralId);

    await db.referral.update({ where: { id: input.referralId }, data: { status: "SCHEDULED" } });

    const obligation = await db.careObligation.findFirst({
      where: {
        journeyId: input.journeyId,
        type: "SCHEDULE_SPECIALIST_APPOINTMENT",
        status: { in: ["OPEN", "IN_PROGRESS", "OVERDUE"] },
      },
    });
    if (obligation) {
      await db.careObligation.update({
        where: { id: obligation.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      await recordAudit({
        actorId: actor.userId,
        actorRole: actor.role,
        action: "COMPLETE_OBLIGATION",
        entityType: "CareObligation",
        entityId: obligation.id,
        newState: "COMPLETED",
        reason: `Fulfilled by appointment ${appointment.id}`,
        requestId: newRequestId(),
      });
    }
  }

  await createCareEvent(
    {
      patientId: input.patientId,
      journeyId: input.journeyId,
      type: "APPOINTMENT",
      title: `${input.type} scheduled with ${input.provider}`,
      occurredAt: new Date(),
      status: "PENDING",
      metadata: { appointmentId: appointment.id, scheduledAt: input.scheduledAt.toISOString() },
    },
    actor
  );

  return appointment;
}
