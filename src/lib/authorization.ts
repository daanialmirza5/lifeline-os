import { db } from "./db";
import { Session } from "./auth";
import { NotFoundError, PatientAccessDeniedError } from "@/domain/errors";

/**
 * Patient-scoped authorization. Role checks (src/lib/auth.ts#requireRole)
 * answer "can this role create referrals at all?"; this answers the
 * question role checks can't: "can *this* clinician see *this* patient?"
 *
 * Access model:
 *   ADMIN     -> unrestricted (administrative oversight).
 *   PATIENT   -> only the single Patient row linked via Patient.userId.
 *   CLINICIAN / COORDINATOR -> only patients with a matching
 *                              CareTeamMembership row.
 *
 * Every patient-scoped Route Handler, Server Action, and page component
 * must call this (or accessiblePatientWhereClause, for list views) before
 * returning or mutating patient data — it is the server-side enforcement
 * the spec requires; nothing here should ever be relied on only in the UI.
 */
export async function requirePatientAccess(patientId: string, session: Session): Promise<void> {
  if (session.role === "ADMIN") return;

  if (session.role === "PATIENT") {
    const patient = await db.patient.findUnique({ where: { id: patientId }, select: { userId: true } });
    if (!patient) throw new NotFoundError("Patient", patientId);
    if (patient.userId !== session.userId) {
      throw new PatientAccessDeniedError();
    }
    return;
  }

  // CLINICIAN / COORDINATOR
  const membership = await db.careTeamMembership.findUnique({
    where: { userId_patientId: { userId: session.userId, patientId } },
    select: { id: true },
  });
  if (!membership) {
    throw new PatientAccessDeniedError();
  }
}

/**
 * The Prisma `where` clause that scopes a patient list/query to exactly
 * what `session` is allowed to see — the list-view counterpart to
 * requirePatientAccess. Using this (rather than fetching everything and
 * filtering in application code) means an inaccessible patient is never
 * even read out of the database, let alone rendered.
 */
export function accessiblePatientWhereClause(session: Session) {
  if (session.role === "ADMIN") return {};
  if (session.role === "PATIENT") return { userId: session.userId };
  return { careTeamMemberships: { some: { userId: session.userId } } };
}
