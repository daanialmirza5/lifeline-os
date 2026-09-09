"use client";

import { useActionState } from "react";
import { uploadDocumentAction, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/primitives";

export function UploadDocumentForm({ patients }: { patients: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(uploadDocumentAction, {});

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-foreground">Patient</label>
        <select name="patientId" required className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-foreground">Filename</label>
        <input name="filename" required placeholder="referral_letter.txt" className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-foreground">
          Document text (synthetic/demo — this prototype ingests plain text, not PDF binaries)
        </label>
        <textarea
          name="rawText"
          required
          rows={5}
          placeholder="Paste the document's text content here..."
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      {state?.error && <p className="text-xs text-[var(--risk-critical)]">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Uploading and extracting..." : "Upload & extract"}
      </Button>
    </form>
  );
}
