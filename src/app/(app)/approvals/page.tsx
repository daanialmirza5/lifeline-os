import { listRecommendationQueue } from "@/lib/services/recommendations";
import { EmptyState } from "@/components/ui/primitives";
import { RecommendationCard } from "@/components/dashboard/RecommendationCard";

export default async function ApprovalsPage() {
  const recommendations = await listRecommendationQueue("SUGGESTED");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Human Approval Queue</h1>
        <p className="text-sm text-muted">
          Every AI recommendation requires an explicit clinician or coordinator decision before it becomes an
          active action. Nothing here has taken effect yet.
        </p>
      </div>

      {recommendations.length === 0 ? (
        <EmptyState title="Nothing awaiting approval" description="All caught up." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {recommendations.map((r) => (
            <RecommendationCard
              key={r.id}
              redirectTo="/approvals"
              rec={{
                id: r.id,
                patientName: r.patient.name,
                agentType: r.agentType,
                recommendation: r.recommendation,
                reasoning: r.reasoning,
                evidence: JSON.parse(r.evidence),
                confidence: r.confidence,
                status: r.status,
                provider: r.provider,
                model: r.model,
                createdAt: r.createdAt.toISOString(),
                decisionNotes: r.decisionNotes,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
