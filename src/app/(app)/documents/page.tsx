import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardBody, EmptyState } from "@/components/ui/primitives";
import { UploadDocumentForm } from "@/components/dashboard/UploadDocumentForm";
import { DocumentReviewCard } from "@/components/dashboard/DocumentReviewCard";

export default async function DocumentsPage() {
  const [documents, patients] = await Promise.all([
    db.document.findMany({ orderBy: { uploadedAt: "desc" }, include: { patient: { select: { name: true } } } }),
    db.patient.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Document Intelligence</h1>
          <p className="text-sm text-muted">
            Document → text extraction → structured extraction → human validation → timeline event. Nothing is
            written to a patient&apos;s timeline until a person accepts the extracted fields.
          </p>
        </div>
        {documents.length === 0 ? (
          <EmptyState title="No documents uploaded yet" />
        ) : (
          <div className="space-y-3">
            {documents.map((d) => (
              <DocumentReviewCard
                key={d.id}
                doc={{
                  id: d.id,
                  patientName: d.patient.name,
                  filename: d.filename,
                  docType: d.docType,
                  status: d.status,
                  extractedFields: d.extractedFields,
                  uploadedAt: d.uploadedAt.toISOString(),
                }}
              />
            ))}
          </div>
        )}
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Upload Document</CardTitle>
        </CardHeader>
        <CardBody>
          <UploadDocumentForm patients={patients} />
        </CardBody>
      </Card>
    </div>
  );
}
