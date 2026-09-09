"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/primitives";

export function RiskRefreshButton({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await fetch(`/api/patients/${patientId}/risk`, { method: "POST" });
          router.refresh();
        })
      }
    >
      {pending ? "Recomputing..." : "Recompute risk"}
    </Button>
  );
}
