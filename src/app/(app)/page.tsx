import Link from "next/link";
import { getDashboardCounts, getAttentionQueue } from "@/lib/services/dashboard";
import { StatCard, Card, CardHeader, CardTitle, CardBody, RiskBadge, EmptyState } from "@/components/ui/primitives";
import { RiskDistributionChart } from "@/components/dashboard/RiskDistributionChart";

export default async function DashboardPage() {
  const [counts, attention] = await Promise.all([getDashboardCounts(), getAttentionQueue()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Command Center</h1>
        <p className="text-sm text-muted">Continuity status across all active patients.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Active Patients" value={counts.activePatients} />
        <StatCard
          label="Requiring Attention"
          value={attention.length}
          hint="HIGH or CRITICAL continuity risk"
        />
        <StatCard label="Overdue Actions" value={counts.overdueObligations} />
        <StatCard label="Pending Referrals" value={counts.pendingReferrals} />
        <StatCard label="Upcoming Follow-ups" value={counts.upcomingAppointments} />
        <StatCard label="Pending Approvals" value={counts.pendingApprovals} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>What Needs Attention Now</CardTitle>
            <Link href="/patients" className="text-xs text-accent hover:underline">
              View all patients
            </Link>
          </CardHeader>
          <CardBody className="space-y-3">
            {attention.length === 0 && (
              <EmptyState
                title="No patients currently at risk"
                description="Every tracked care journey is on schedule."
              />
            )}
            {attention.map((item, i) => (
              <Link
                key={item.patientId}
                href={`/patients/${item.patientId}/risk`}
                className="block rounded-md border border-border p-3 hover:bg-black/[.02] dark:hover:bg-white/[.04]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted">#{i + 1} PATIENT</p>
                    <p className="text-sm font-medium text-foreground">{item.patientName}</p>
                  </div>
                  <RiskBadge level={item.riskLevel} />
                </div>
                <p className="mt-2 text-sm text-foreground">
                  <span className="font-medium">Reason: </span>
                  {item.reason}
                </p>
                <p className="mt-1 text-sm text-muted">
                  <span className="font-medium text-foreground">Next recommended action: </span>
                  {item.recommendedAction}
                </p>
                <p className="mt-1 text-xs text-muted">Status: {item.approvalState}</p>
              </Link>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Continuity Risk Distribution</CardTitle>
          </CardHeader>
          <CardBody>
            <RiskDistributionChart distribution={counts.riskDistribution} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
