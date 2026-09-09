import { db } from "@/lib/db";
import { recordAudit, newRequestId } from "@/lib/audit";
import { ConflictError, NotFoundError } from "@/domain/errors";
import { Session } from "@/lib/auth";
import { runCoordinationAgent } from "@/ai/agents/coordination-agent";
import { runRiskExplanationAgent } from "@/ai/agents/risk-explanation-agent";
import { runCommunicationAgent } from "@/ai/agents/communication-agent";
import { RiskFactor } from "@/domain/risk-engine";

function toObligationView(o: { id: string; description: string; status: string; dueAt: Date }) {
  return { id: o.id, description: o.description, status: o.status, dueAt: o.dueAt.toISOString() };
}

/**
 * Generates coordination recommendations for a journey's open obligations.
 * Idempotent per obligation: skips obligations that already have a
 * SUGGESTED recommendation, so calling this repeatedly (e.g. on every
 * dashboard load) doesn't spam duplicate suggestions.
 */
export async function generateCoordinationRecommendations(patientId: string, journeyId: string) {
  const openObligations = await db.careObligation.findMany({
    where: { patientId, journeyId, status: { in: ["OPEN", "IN_PROGRESS", "OVERDUE"] } },
    orderBy: { dueAt: "asc" },
  });
  if (openObligations.length === 0) return [];

  const alreadySuggested = await db.aIRecommendation.findMany({
    where: {
      obligationId: { in: openObligations.map((o) => o.id) },
      status: "SUGGESTED",
    },
    select: { obligationId: true },
  });
  const suggestedIds = new Set(alreadySuggested.map((r) => r.obligationId));
  const targets = openObligations.filter((o) => !suggestedIds.has(o.id));
  if (targets.length === 0) return [];

  const result = await runCoordinationAgent({
    openObligations: targets.map(toObligationView),
  });

  const created = [];
  for (let i = 0; i < targets.length && i < result.output.actions.length; i++) {
    const obligation = targets[i];
    const action = result.output.actions[i];
    const rec = await db.aIRecommendation.create({
      data: {
        patientId,
        journeyId,
        obligationId: obligation.id,
        agentType: "COORDINATION",
        recommendation: action.action,
        reasoning: action.rationale,
        evidence: JSON.stringify([
          `Obligation: ${obligation.description}`,
          `Status: ${obligation.status}`,
          `Due: ${obligation.dueAt.toISOString()}`,
        ]),
        confidence: result.usedFallback ? 0.5 : 0.85,
        status: "SUGGESTED",
        provider: result.provider,
        model: result.model,
      },
    });
    created.push(rec);
  }
  return created;
}

export async function generateRiskExplanationRecommendation(
  patientId: string,
  journeyId: string,
  riskScore: number,
  riskLevel: string,
  factors: RiskFactor[]
) {
  if (factors.length === 0) return null;

  const result = await runRiskExplanationAgent({ riskScore, riskLevel, factors });
  return db.aIRecommendation.create({
    data: {
      patientId,
      journeyId,
      agentType: "RISK_EXPLANATION",
      recommendation: result.output.recommendedAction,
      reasoning: result.output.explanation,
      evidence: JSON.stringify(factors.map((f) => `${f.factor} (+${f.weight})`)),
      confidence: result.usedFallback ? 0.5 : 0.85,
      status: "SUGGESTED",
      provider: result.provider,
      model: result.model,
    },
  });
}

export async function generateCommunicationDraft(
  patientId: string,
  patientName: string,
  purpose: string,
  journeyId?: string
) {
  const result = await runCommunicationAgent({ patientName, purpose });
  return db.aIRecommendation.create({
    data: {
      patientId,
      journeyId: journeyId ?? null,
      agentType: "COMMUNICATION",
      recommendation: `${result.output.subject}\n\n${result.output.body}`,
      reasoning: `Drafted for: ${purpose}`,
      evidence: JSON.stringify([`Channel: ${result.output.channel}`, `Purpose: ${purpose}`]),
      confidence: result.usedFallback ? 0.5 : 0.85,
      status: "SUGGESTED",
      provider: result.provider,
      model: result.model,
    },
  });
}

export type RecommendationDecision = "APPROVED" | "REJECTED" | "EDITED";

export async function decideRecommendation(
  recommendationId: string,
  decision: RecommendationDecision,
  actor: Session,
  notes?: string,
  editedRecommendation?: string
) {
  const rec = await db.aIRecommendation.findUnique({ where: { id: recommendationId } });
  if (!rec) throw new NotFoundError("AIRecommendation", recommendationId);
  if (rec.status !== "SUGGESTED") {
    throw new ConflictError(
      `Recommendation ${recommendationId} has already been decided (status: ${rec.status}).`
    );
  }

  const finalText = decision === "EDITED" && editedRecommendation ? editedRecommendation : rec.recommendation;

  const decided = await db.aIRecommendation.update({
    where: { id: recommendationId },
    data: {
      status: decision,
      decidedById: actor.userId,
      decidedAt: new Date(),
      decisionNotes: notes ?? null,
      recommendation: finalText,
    },
  });

  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: `RECOMMENDATION_${decision}`,
    entityType: "AIRecommendation",
    entityId: recommendationId,
    previousState: "SUGGESTED",
    newState: decision,
    reason: notes ?? null,
    requestId: newRequestId(),
  });

  if (decision === "APPROVED" || decision === "EDITED") {
    await executeRecommendation(decided, actor);
  }

  return decided;
}

/**
 * Turns an approved recommendation into a concrete action. COORDINATION
 * recommendations become a coordinator Task. COMMUNICATION recommendations
 * are marked executed as a clearly-labeled demo simulation — this
 * prototype has no real SMS/email/portal integration to send through.
 * RISK_EXPLANATION recommendations are informational only; approval just
 * acknowledges them.
 */
async function executeRecommendation(
  rec: { id: string; patientId: string; journeyId: string | null; obligationId: string | null; agentType: string; recommendation: string },
  actor: Session
) {
  if (rec.agentType === "COORDINATION" && rec.journeyId) {
    await db.task.create({
      data: {
        patientId: rec.patientId,
        journeyId: rec.journeyId,
        obligationId: rec.obligationId,
        title: rec.recommendation,
        description: `Created from approved AI recommendation ${rec.id}.`,
        assignedRole: "COORDINATOR",
        priority: "MEDIUM",
        status: "OPEN",
      },
    });
  }

  await db.aIRecommendation.update({
    where: { id: rec.id },
    data: { status: "EXECUTED" },
  });

  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: "RECOMMENDATION_EXECUTED",
    entityType: "AIRecommendation",
    entityId: rec.id,
    previousState: "APPROVED",
    newState: "EXECUTED",
    reason:
      rec.agentType === "COMMUNICATION"
        ? "Demo simulation: message marked as sent (no real messaging integration)."
        : rec.agentType === "COORDINATION"
          ? "Coordinator task created."
          : "Acknowledged.",
    requestId: newRequestId(),
  });
}

export async function listRecommendationQueue(status?: string) {
  return db.aIRecommendation.findMany({
    where: status ? { status } : { status: "SUGGESTED" },
    include: { patient: true },
    orderBy: { createdAt: "desc" },
  });
}
