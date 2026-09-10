import { db } from "@/lib/db";
import { NotFoundError } from "@/domain/errors";
import { Session } from "@/lib/auth";
import { accessiblePatientWhereClause, requirePatientAccess } from "@/lib/authorization";

export async function listPatients(session: Session) {
  return db.patient.findMany({
    where: accessiblePatientWhereClause(session),
    orderBy: { name: "asc" },
    include: {
      journeys: { orderBy: { createdAt: "desc" }, take: 1 },
      riskAssessments: { orderBy: { computedAt: "desc" }, take: 1 },
    },
  });
}

export async function getPatientOrThrow(patientId: string, session: Session) {
  await requirePatientAccess(patientId, session);
  const patient = await db.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw new NotFoundError("Patient", patientId);
  return patient;
}

export async function getPatientDetail(patientId: string, session: Session) {
  await requirePatientAccess(patientId, session);
  const patient = await db.patient.findUnique({
    where: { id: patientId },
    include: {
      journeys: { orderBy: { createdAt: "desc" } },
      riskAssessments: { orderBy: { computedAt: "desc" }, take: 1 },
      obligations: { orderBy: { dueAt: "asc" } },
    },
  });
  if (!patient) throw new NotFoundError("Patient", patientId);
  return patient;
}

function generateMrn(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `MRN-${num}`;
}

/**
 * Creates a patient and, for a CLINICIAN/COORDINATOR actor, immediately
 * puts them on the new patient's care team. Without this, the person who
 * just created the patient would fail requirePatientAccess on their very
 * next request to view the record they created.
 */
export async function createPatient(input: { name: string; dob: Date; mrn?: string }, actor: Session) {
  const patient = await db.patient.create({
    data: {
      name: input.name,
      dob: input.dob,
      mrn: input.mrn ?? generateMrn(),
    },
  });

  if (actor.role === "CLINICIAN" || actor.role === "COORDINATOR") {
    await db.careTeamMembership.create({
      data: { userId: actor.userId, patientId: patient.id, role: actor.role },
    });
  }

  return patient;
}
