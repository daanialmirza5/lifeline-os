import Link from "next/link";
import { getPatientOrThrow } from "@/lib/services/patients";
import { getLatestRisk } from "@/lib/services/risk";
import { RiskBadge, Card, CardBody } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { getSession, Session } from "@/lib/auth";
import { PatientAccessDeniedError } from "@/domain/errors";

const TABS = [
  { href: "", label: "Overview" },
  { href: "/timeline", label: "Timeline" },
  { href: "/journey", label: "Care Journey" },
  { href: "/obligations", label: "Obligations" },
  { href: "/risk", label: "Risk" },
  { href: "/replay", label: "Replay" },
];

// Kept separate from the component body (rather than a try/catch wrapped
// around the JSX return) so the access check is pure data/control flow —
// React doesn't render JSX synchronously, so a try/catch around a JSX
// return doesn't actually guard rendering errors the way it looks like it
// does; isolating it here avoids that footgun entirely.
async function loadPatientOrDenied(patientId: string, session: Session) {
  try {
    return { denied: false as const, patient: await getPatientOrThrow(patientId, session) };
  } catch (err) {
    if (err instanceof PatientAccessDeniedError) return { denied: true as const };
    throw err;
  }
}

export default async function PatientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Every sub-route under here renders through this layout, so the access
  // check happens once, here — returning early (not rendering {children})
  // means a denied request never even reaches a sub-page's own data
  // fetching. Individual API routes still enforce this independently too
  // (see src/lib/authorization.ts) since they're reachable without going
  // through this layout at all.
  const session = await getSession();
  if (!session) return null; // the (app) layout already redirects unauthenticated users

  const result = await loadPatientOrDenied(id, session);
  if (result.denied) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <p className="text-sm font-semibold text-[var(--risk-critical)]">Access Denied</p>
          <p className="mt-2 text-sm text-muted">
            You are not on this patient&apos;s care team, so you don&apos;t have access to their record.
            {session.role === "ADMIN" ? "" : " Contact an administrator if you believe this is an error."}
          </p>
        </CardBody>
      </Card>
    );
  }

  const { patient } = result;
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
