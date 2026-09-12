# Lifeline OS — Engineering Guide & Mastery Document

## 1. What Is Lifeline OS?
Lifeline OS is an **intelligent healthcare continuity and clinical encounter layer** designed for low-resource clinics, disaster response scenarios, and community health networks. It bridges disconnected healthcare workflows by maintaining an offline-first clinical graph, synchronizing clinical data via Conflict-Free Replicated Data Type (CRDT) principles, structuring emergency triage protocols, and generating grounded clinical handover summaries.

*Disclaimer: Lifeline OS is a research and demonstration prototype, not a certified medical device.*

## 2. Real-World Problem Solved
1. **Fragmented Patient History**: Patients transitioning between rural clinics, emergency transports, and district hospitals lose critical clinical history.
2. **Intermittent Connectivity**: Rural facilities experience frequent network blackouts where cloud-only Electronic Health Records (EHR) fail completely.
3. **Clinical Handover Errors**: Shift handovers and referral transfers often omit critical drug allergies, vital trajectories, or pending lab results.
4. **Unvalidated AI in Medicine**: Using unchecked LLMs in healthcare risks lethal hallucinations. Lifeline OS enforces strict deterministic schema boundaries.

## 3. High-Level Architecture
- **Frontend & App Layer**: Next.js 15, TypeScript, Tailwind CSS, Radix UI.
- **Data & ORM**: Prisma ORM with SQLite (local) / PostgreSQL (server).
- **Offline Sync Engine**:
  - `src/offline/sync-engine.ts`: Version-vector change tracking, local IndexedDB mutation queues, and deterministic Last-Write-Wins (LWW) with clinical priority merge rules.
- **Clinical Graph & Journey Engine**:
  - `src/domain/encounter-graph.ts`: Directed clinical timeline connecting encounters, vitals, diagnoses, prescriptions, and lab orders.
- **AI Handover Summarizer**:
  - `src/ai/handover-agent.ts`: Summarizes longitudinal patient records using validated FHIR-like context injection with strict schema boundary validation.
- **Testing**: Vitest unit/integration suite + Playwright E2E tests.

## 4. Algorithmic Complexity & Data Models
- **Clinical Encounter Graph**: DAG of clinical events where nodes represent immutable clinical observations and directed edges represent care transitions.
- **Offline Merge Conflict Resolution**: Multi-attribute timestamped vector clocks with additive union on allergies and active medications.

## 5. Security, Privacy & Compliance Controls
- Role-Based Access Control (RBAC): Distinct permissions for Doctor, Nurse, Paramedic, and Administrator.
- Audit Logging: Append-only clinical audit trail recording every read, write, and export event.
- Zero Patient Identifiers in AI Prompts: Synthesized de-identified clinical tokens used during LLM handover generation.

## 6. Testing Strategy
- Vitest unit tests covering schema validation, conflict resolution merges, and triage scoring.
- Playwright E2E suites verifying full offline-to-online sync cycles and patient journey rendering.
