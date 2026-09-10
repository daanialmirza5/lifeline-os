import Link from "next/link";
import { listPatients } from "@/lib/services/patients";
import { Card, RiskBadge, StatusBadge, EmptyState } from "@/components/ui/primitives";
import { getSession } from "@/lib/auth";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ risk?: string }>;
}) {
  const { risk } = await searchParams;
  const session = await getSession();
  if (!session) return null;
  const patients = await listPatients(session);
  const filtered = risk ? patients.filter((p) => p.riskAssessments[0]?.riskLevel === risk) : patients;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Patients</h1>
        <p className="text-sm text-muted">
          {filtered.length} patient{filtered.length === 1 ? "" : "s"}
          {risk ? ` with ${risk} continuity risk` : ""}
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No patients found" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">MRN</th>
                <th className="px-4 py-3 font-medium">Journey</th>
                <th className="px-4 py-3 font-medium">Continuity Risk</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-black/[.02] dark:hover:bg-white/[.03]">
                  <td className="px-4 py-3">
                    <Link href={`/patients/${p.id}`} className="font-medium text-foreground hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{p.mrn}</td>
                  <td className="px-4 py-3">
                    {p.journeys[0] ? <StatusBadge status={p.journeys[0].state} /> : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {p.riskAssessments[0] ? (
                      <RiskBadge level={p.riskAssessments[0].riskLevel} />
                    ) : (
                      <span className="text-muted">Not assessed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
