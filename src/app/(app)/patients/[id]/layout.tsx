import Link from "next/link";
import { getPatientOrThrow } from "@/lib/services/patients";
import { getLatestRisk } from "@/lib/services/risk";
import { RiskBadge } from "@/components/ui/primitives";
import { db } from "@/lib/db";

const TABS = [
  { href: "", label: "Overview" },
  { href: "/timeline", label: "Timeline" },
  { href: "/journey", label: "Care Journey" },
  { href: "/obligations", label: "Obligations" },
  { href: "/risk", label: "Risk" },
];

export default async function PatientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await getPatientOrThrow(id);
  const risk = await getLatestRisk(id);
  const journey = await db.careJourney.findFirst({ where: { patientId: id }, orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{patient.name}</h1>
          <p className="text-sm text-muted">
            {patient.mrn} · DOB {patient.dob.toISOString().slice(0, 10)}
            {journey ? ` · ${journey.title}` : ""}
          </p>
        </div>
        {risk && <RiskBadge level={risk.riskLevel} />}
      </div>

      <nav className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={`/patients/${id}${tab.href}`}
            className="rounded-t-md px-3 py-2 text-sm text-muted hover:text-foreground"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
