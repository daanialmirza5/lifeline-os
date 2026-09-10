import { db } from "@/lib/db";
import { recordAudit, newRequestId } from "@/lib/audit";
import { Session } from "@/lib/auth";
import { runDocumentExtractionAgent } from "@/ai/agents/document-extraction-agent";
import { NotFoundError, ValidationError } from "@/domain/errors";
import { createCareEvent } from "./events";
import { requirePatientAccess } from "@/lib/authorization";

/**
 * Document -> text extraction -> structured extraction -> validation ->
 * timeline event (spec section 18). Extraction results are held in
 * `extractedFields` for human review; nothing is written to the patient
 * timeline until a person calls `validateDocument`.
 */
export async function uploadDocument(
  input: { patientId: string; journeyId?: string; filename: string; rawText: string },
  actor: Session
) {
  await requirePatientAccess(input.patientId, actor);

  const doc = await db.document.create({
    data: {
      patientId: input.patientId,
      journeyId: input.journeyId ?? null,
      filename: input.filename,
      status: "UPLOADED",
      rawTextSanitized: input.rawText.slice(0, 8000),
      uploadedById: actor.userId,
    },
  });

  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: "UPLOAD_DOCUMENT",
    entityType: "Document",
    entityId: doc.id,
    newState: "UPLOADED",
    requestId: newRequestId(),
  });

  const result = await runDocumentExtractionAgent({ rawText: input.rawText, filename: input.filename });

  const extracted = await db.document.update({
    where: { id: doc.id },
    data: {
      status: "EXTRACTED",
      docType: result.output.documentType,
      extractedFields: JSON.stringify(result.output),
    },
  });

  return { document: extracted, extraction: result };
}

export async function validateDocument(
  documentId: string,
  approvedFields: Record<string, unknown>,
  actor: Session
) {
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new NotFoundError("Document", documentId);
  await requirePatientAccess(doc.patientId, actor);
  if (doc.status !== "EXTRACTED") {
    throw new ValidationError(`Document ${documentId} is not awaiting validation (status: ${doc.status}).`);
  }

  const validated = await db.document.update({
    where: { id: documentId },
    data: { status: "VALIDATED", extractedFields: JSON.stringify(approvedFields) },
  });

  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: "VALIDATE_DOCUMENT",
    entityType: "Document",
    entityId: documentId,
    previousState: "EXTRACTED",
    newState: "VALIDATED",
    requestId: newRequestId(),
  });

  if (doc.journeyId) {
    await createCareEvent(
      {
        patientId: doc.patientId,
        journeyId: doc.journeyId,
        type: "DOCUMENT",
        title: `Document validated: ${doc.filename}`,
        description: typeof approvedFields.summary === "string" ? approvedFields.summary : undefined,
        metadata: { documentId },
      },
      actor
    );
  }

  return validated;
}

export async function rejectDocument(documentId: string, reason: string, actor: Session) {
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new NotFoundError("Document", documentId);
  await requirePatientAccess(doc.patientId, actor);

  const updated = await db.document.update({ where: { id: documentId }, data: { status: "REJECTED" } });

  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: "REJECT_DOCUMENT",
    entityType: "Document",
    entityId: documentId,
    previousState: doc.status,
    newState: "REJECTED",
    reason,
    requestId: newRequestId(),
  });

  return updated;
}
