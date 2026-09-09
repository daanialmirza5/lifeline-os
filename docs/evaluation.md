# Evaluation

Every number below was produced by running `npm run evaluate`
(`scripts/evaluate.ts`) or the test suites, on this codebase, on this seed
data — not estimated or invented. Re-run `npm run db:setup && npm run
evaluate` to reproduce. Where something wasn't measured, it says "Not
evaluated" rather than a guessed number, per the brief's explicit
instruction.

## Workflow engine: transition correctness

```
Total ordered state pairs (excluding no-op): 56
Declared-valid transitions: 20 (35.7%)
Declared-invalid transitions: 36 (64.3%)
Engine correctness: 20/20 valid transitions accepted, 36/36 invalid
transitions rejected — 100% correct
```

This exhaustively checks every one of the 8×7=56 ordered `(from, to)`
state pairs (excluding same-state) against `validateJourneyTransition`,
confirming it agrees with the declared transition table in
`src/domain/types.ts` in all 56 cases, including terminal-state rejection
and out-of-order transitions. `tests/unit/workflow.test.ts` covers the
same logic with named cases (including duplicate-transition and every
terminal state explicitly).

## Risk engine: deterministic correctness

Not measured as a percentage (there's no "ground truth" risk score to
compare against — the engine's output *is* the specification, by design;
see `docs/domain-model.md`). Instead, `tests/unit/risk-engine.test.ts`
verifies: identical input always produces identical output (determinism),
each threshold boundary maps to the correct level, each factor category
triggers independently at its documented weight, the inactivity and
repeated-contact thresholds are respected exactly at the boundary, and the
score clamps correctly at 100 when every factor is simultaneously active.

## AI document extraction: follow-up detection accuracy

```
referral_letter.txt:    expected=true  got=true   OK
lab_result.txt:         expected=false got=false  OK
discharge_summary.txt:  expected=true  got=true   OK
consult_note.txt:       expected=false got=false  OK
follow-up-detection accuracy: 4/4 (100.0%)
```

Against a 4-document synthetic test set
(`scripts/evaluate.ts#EXTRACTION_TEST_SET`), the **Mock provider's**
regex-based follow-up detector (`/follow[\s-]?up/i` against the document
text) scored 100%. This is a small, hand-picked set — not a claim of
general accuracy, and 4 examples is not enough to draw a confidence
interval from.

**`documentType` classification was NOT evaluated.** The Mock provider
always returns `UNKNOWN` for this field rather than attempting real
classification (see `src/ai/providers/mock.ts#renderDocumentExtraction`)
— there is no real prediction being made, so there's nothing meaningful to
score. A real LLM provider (Anthropic/OpenAI/Google) would need its own
evaluation run against this same test set, which has not been done in this
build (no API keys were available in this environment — see
`docs/ai-architecture.md` "Not evaluated").

## Recommendation quality: evidence grounding

```
Total recommendations: 8
With non-empty evidence array: 8/8 (100.0%)
With empty evidence (unsupported): 0/8
```

Against the current seed data (7 named scenario patients + 13 volume
patients), every generated `AIRecommendation` carries a non-empty
`evidence` array sourced directly from the obligation/risk data that
prompted it — measured by checking `evidence.length > 0` for every row,
not by semantic judgment of evidence quality. This is a weak but honest
proxy: it confirms the architectural guarantee (recommendations are always
constructed with real evidence attached — see
`src/lib/services/recommendations.ts`) rather than measuring whether a
human would find the evidence persuasive.

**Not evaluated**: unsupported-recommendation rate in the stronger sense
(does the evidence actually justify the recommendation, as judged by a
person or an LLM-as-judge) — this would need a human-labeled or
LLM-judge evaluation set, which doesn't exist in this build.

## Sync engine: idempotency and conflict detection

Not run as a statistical rate — proven as exact, deterministic properties
via `tests/integration/sync.test.ts`:

- A retried `operationId` produces exactly one `SyncOperation` row and
  increments `Task.version` exactly once (not twice) — the duplicate rate
  for this specific, tested scenario is 0%.
- A stale `baseVersion` is detected as `CONFLICT` 100% of the time (the
  test constructs a guaranteed-stale version and asserts the result), and
  the server-side value is never overwritten by the conflicting local one.
- Two distinct `operationId`s for the same entity are recorded as two
  separate `SyncOperation` rows, never merged or deduplicated incorrectly.

## Test suite summary

As of this evaluation:

- **Unit**: 9 files, run via `npm run test:unit` (see `tests/unit/`) —
  risk engine, workflow, obligations, sanitize, AI prompt validation,
  schemas.
- **Integration**: covered by `npm run test:integration` (see
  `tests/integration/`) — full domain pipeline, task concurrency,
  authentication, sync idempotency/conflict.
- **Combined unit + integration**: 62 tests, all passing at the time of
  writing (`npm test`).
- **E2E**: 4 Playwright scenarios (`tests/e2e/`), matching the spec's 4
  named scenarios exactly, all passing at the time of writing (`npm run
  test:e2e`) — see each spec file for what real bugs each one caught
  during development (documented in their commit messages and in
  `docs/offline-sync.md`).

Exact current pass/fail counts are in the top-level README's "Testing"
section, generated from the actual last run rather than copied here to
avoid the two going stale independently.

## Not evaluated (explicit)

- Real LLM provider behavior (Anthropic/OpenAI/Google) — only the Mock
  provider has been exercised.
- Load/performance testing under concurrent users.
- Accessibility audit beyond manual checks (semantic HTML, focus states,
  `prefers-reduced-motion`) — no automated tool (axe, Lighthouse) was run.
- Cross-browser testing — only Chromium (via Playwright) was used.
- Production Postgres deployment — schema and docker-compose exist but
  have not been run end-to-end (see `docs/architecture.md`).
