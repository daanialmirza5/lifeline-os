import { db } from "@/lib/db";
import { NotFoundError } from "@/domain/errors";

export async function listPatients() {
  return db.patient.findMany({
    orderBy: { name: "asc" },
    include: {
      journeys: { orderBy: { createdAt: "desc" }, take: 1 },
      riskAssessments: { orderBy: { computedAt: "desc" }, take: 1 },
    },
  });
}

export async function getPatientOrThrow(patientId: string) {
  const patient = await db.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw new NotFoundError("Patient", patientId);
  return patient;
}

export async function getPatientDetail(patientId: string) {
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

export async function createPatient(input: { name: string; dob: Date; mrn?: string }) {
  return db.patient.create({
    data: {
      name: input.name,
      dob: input.dob,
      mrn: input.mrn ?? generateMrn(),
    },
  });
}
