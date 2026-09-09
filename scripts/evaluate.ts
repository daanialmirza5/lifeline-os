// Small, honest evaluation harness (spec section 31). Every number this
// script prints is actually computed from the code/data at run time — none
// of it is hand-typed into docs/evaluation.md. Re-run with `npm run evaluate`
// any time the code changes; the doc should be updated to match.
import "dotenv/config";
import { JOURNEY_STATES, JOURNEY_TRANSITIONS, JourneyState } from "../src/domain/types";
import { validateJourneyTransition } from "../src/domain/workflow";
import { runDocumentExtractionAgent } from "../src/ai/agents/document-extraction-agent";
import { db } from "../src/lib/db";

async function evaluateWorkflowEngine() {
  const states = JOURNEY_STATES as readonly JourneyState[];
  let validCount = 0;
  let rejectedCount = 0;
  let validAccepted = 0;
  let invalidRejected = 0;

  for (const from of states) {
    for (const to of states) {
      if (from === to) continue;
      const isDeclaredValid = JOURNEY_TRANSITIONS[from].includes(to);
      if (isDeclaredValid) validCount++;
      else rejectedCount++;

      try {
        validateJourneyTransition(from, to);
        if (isDeclaredValid) validAccepted++;
      } catch {
        if (!isDeclaredValid) invalidRejected++;
      }
    }
  }

  const total = validCount + rejectedCount;
  console.log("\n=== Workflow engine ===");
  console.log(`Total ordered state pairs (excluding no-op): ${total}`);
  console.log(`Declared-valid transitions: ${validCount} (${((validCount / total) * 100).toFixed(1)}%)`);
  console.log(`Declared-invalid transitions: ${rejectedCount} (${((rejectedCount / total) * 100).toFixed(1)}%)`);
  console.log(
    `Engine correctness: ${validAccepted}/${validCount} valid transitions accepted, ${invalidRejected}/${rejectedCount} invalid transitions rejected` +
      (validAccepted === validCount && invalidRejected === rejectedCount ? " — 100% correct" : " — MISMATCH")
  );
}

interface ExtractionCase {
  filename: string;
  rawText: string;
  expectedFollowUpRequired: boolean;
}

const EXTRACTION_TEST_SET: ExtractionCase[] = [
  {
    filename: "referral_letter.txt",
    rawText:
      "Referral letter to Dr. Nguyen, Cardiology. Patient presents with elevated troponin. Please schedule a follow-up within two weeks.",
    expectedFollowUpRequired: true,
  },
  {
    filename: "lab_result.txt",
    rawText: "Lab result: complete blood count within normal limits. No further action required.",
    expectedFollowUpRequired: false,
  },
  {
    filename: "discharge_summary.txt",
    rawText: "Patient discharged in stable condition. Follow up with primary care physician in 1 week.",
    expectedFollowUpRequired: true,
  },
  {
    filename: "consult_note.txt",
    rawText: "Routine annual physical. All findings normal. Return to clinic as needed.",
    expectedFollowUpRequired: false,
  },
];

async function evaluateDocumentExtraction() {
  console.log("\n=== AI document extraction (Mock provider — deterministic) ===");
  let correctFollowUp = 0;

  for (const testCase of EXTRACTION_TEST_SET) {
    const result = await runDocumentExtractionAgent({ rawText: testCase.rawText, filename: testCase.filename });
    const got = result.output.followUpRequired;
    const ok = got === testCase.expectedFollowUpRequired;
    if (ok) correctFollowUp++;
    console.log(
      `  ${testCase.filename}: followUpRequired expected=${testCase.expectedFollowUpRequired} got=${got} ${ok ? "OK" : "MISS"}; documentType=${result.output.documentType}`
    );
  }

  const accuracy = (correctFollowUp / EXTRACTION_TEST_SET.length) * 100;
  console.log(`follow-up-detection accuracy: ${correctFollowUp}/${EXTRACTION_TEST_SET.length} (${accuracy.toFixed(1)}%)`);
  console.log(
    "documentType classification: the Mock provider does not attempt real document-type classification " +
      "(always returns UNKNOWN) — this is a known, honestly-reported limitation of the deterministic fallback, " +
      "not evaluated as 'accuracy' since there is no real prediction being made. A real LLM provider would need " +
      "separate evaluation against this same test set."
  );
}

async function evaluateRecommendationGrounding() {
  console.log("\n=== Recommendation evidence grounding (current seeded database) ===");
  const recommendations = await db.aIRecommendation.findMany();
  if (recommendations.length === 0) {
    console.log("No recommendations in the database — run `npm run db:seed` first. Skipping.");
    return;
  }

  let grounded = 0;
  let emptyEvidence = 0;

  for (const rec of recommendations) {
    const evidence: string[] = JSON.parse(rec.evidence);
    if (evidence.length === 0) {
      emptyEvidence++;
      continue;
    }
    grounded++;
  }

  console.log(`Total recommendations: ${recommendations.length}`);
  console.log(
    `With non-empty evidence array: ${grounded}/${recommendations.length} (${((grounded / recommendations.length) * 100).toFixed(1)}%)`
  );
  console.log(`With empty evidence (unsupported): ${emptyEvidence}/${recommendations.length}`);
}

async function main() {
  await evaluateWorkflowEngine();
  await evaluateDocumentExtraction();
  await evaluateRecommendationGrounding();
  console.log("\nDone.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
