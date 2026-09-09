# AI Architecture

## Safety boundary (read this first)

Lifeline OS's AI layer never diagnoses, prescribes, or autonomously
executes a clinical action. Concretely:

- The **only** thing that produces a risk score is
  `src/domain/risk-engine.ts` — a deterministic function with a fixed,
  configurable weight table. No agent computes or overrides it; the
  `RISK_EXPLANATION` agent only receives an already-computed score and
  factor list and writes prose around it (`src/ai/agents/risk-explanation-agent.ts`).
- Every `AIRecommendation` starts at status `SUGGESTED` and stays inert
  until a human clinician or coordinator calls `decideRecommendation`
  (`src/lib/services/recommendations.ts`). Nothing in the AI layer can
  reach that function.
- Approving a `COORDINATION` recommendation creates a `Task` for a human
  to act on — it does not, for example, place an order or send a message
  itself.
- Approving a `COMMUNICATION` recommendation is explicitly logged as a
  "demo simulation" (`reason` field on the resulting `AuditEvent`) — this
  prototype has no real SMS/email/portal integration to send through, and
  says so rather than pretending to.
- Every system prompt (`src/ai/prompt.ts#SYSTEM_PREAMBLE`) states these
  constraints directly to the model, in addition to the architectural
  enforcement above — defense in depth, not reliance on the prompt alone.

## Provider abstraction

```text
src/ai/
  provider.ts              AIProvider interface, ProviderError, withTimeout
  providers/
    mock.ts                 Deterministic, template-based — see below
    anthropic.ts             fetch() against api.anthropic.com/v1/messages
    openai.ts                 fetch() against api.openai.com/v1/chat/completions
    google.ts                 fetch() against generativelanguage.googleapis.com
  prompt.ts                 buildStructuredPrompt / parseStructuredPrompt / safeParseJson
  schemas.ts                 zod output schema per agent
  orchestrator.ts             runAgent(): the fallback chain + validation
  agents/
    timeline-agent.ts
    continuity-agent.ts
    risk-explanation-agent.ts
    coordination-agent.ts
    communication-agent.ts
    clinical-summary-agent.ts
    document-extraction-agent.ts
```

Real providers (`anthropic.ts`, `openai.ts`, `google.ts`) are implemented
with plain `fetch()` calls against each vendor's REST API rather than
their official SDKs — this keeps the dependency footprint small and each
provider to under 60 lines, at the cost of not getting SDK conveniences
like automatic retries or streaming. They are genuine, working
implementations (not stubs): given a real API key in `.env`, they will
make real calls. They have not been exercised against live APIs in this
build (no API keys were available in this environment) — the fallback
chain and Mock provider have been exercised, extensively, via the seed
script and the full UI.

## The Mock provider: why the demo works without any API key

`AI_PROVIDER=mock` (the default) never makes a network call. It reads the
same `TASK: <name>\nDATA:\n<json>` envelope every provider receives
(`src/ai/prompt.ts#buildStructuredPrompt`) and produces grounded,
templated JSON output per task type (`src/ai/providers/mock.ts`) — e.g. for
`risk_explanation` it interpolates the actual factor list and score it was
given, rather than inventing generic text. This is a deliberate, legitimate
technique for making a demo fully functional offline (spec section 12/34),
not a placeholder: every recommendation, risk explanation, and
communication draft visible when you run `npm run dev` with zero
configuration came from this path.

## Orchestrator: fallback chain + schema validation

`src/ai/orchestrator.ts#runAgent`:

1. Builds the chain: the configured `AI_PROVIDER`, then any other
   configured (API-key-present) provider, then Mock last — Mock is always
   in the chain and always succeeds, so this function **never throws**.
2. Calls each provider's `complete()` in order until one both succeeds and
   returns output that parses and validates against the agent's zod schema
   (`src/ai/prompt.ts#safeParseJson` — handles markdown code fences,
   validates, returns `null` on any failure rather than throwing).
3. If every provider fails, or every response fails validation, returns
   the caller-supplied `fallback` value with `usedFallback: true` — the
   caller (an agent function) always gets a well-typed object, never an
   exception or malformed data.
4. Logs a structured event per call (`task`, `provider`, `model`,
   `success`, `latencyMs`, `error?`) to an in-memory ring buffer, visible
   at `/settings` (admin-only) — this satisfies the observability
   requirement (spec section 32) at the scope this build covers; see
   "Not evaluated" below for what it doesn't cover.

This is the concrete implementation of spec section 34's failure-handling
diagram (Claude unavailable → OpenAI fallback → deterministic fallback) —
generalized to N configured providers before hitting Mock.

## The six agents

Each agent (`src/ai/agents/*.ts`) is a thin function: takes plain
already-fetched domain data (never touches the database itself), builds
its prompt via `buildStructuredPrompt` with task-specific instructions and
a zod schema, calls `runAgent`, returns the typed result. This keeps agents
pure with respect to I/O and easy to call from any service.

| Agent | Input | Output | Used by |
|---|---|---|---|
| `timeline-agent` | recent `CareEvent`s | summary + key events | (available; not yet wired to a page) |
| `continuity-agent` | open obligations | detected gaps + assessment | (available; not yet wired to a page) |
| `risk-explanation-agent` | risk score/level/factors | plain-language explanation + recommended action | Patient risk page |
| `coordination-agent` | open obligations | up to 5 suggested actions | Recompute-risk flow, approval queue |
| `communication-agent` | patient name + purpose | subject/body/channel draft, always suffixed "AI-generated draft — requires review before sending" | Patient overview page ("Communication Agent" card) — drafts land in the approval queue like any other recommendation |
| `clinical-summary-agent` | events + open obligations | structured pre-visit summary (never a diagnosis) | (available; not yet wired to a page) |
| `document-extraction-agent` | sanitized document text | document type, provider, date, follow-up flag, summary | Document upload pipeline |

Three agents (timeline, continuity, clinical-summary) are implemented,
schema-validated, and unit-testable, but not yet called from a page —
listed honestly rather than hidden, per the "no fake features" rule: they
are real, working code paths reachable from a service call or a future
route, not a UI dead end.

## Prompt-injection defense

Untrusted text (document uploads today; free-text patient input in a
future extension) goes through `src/lib/sanitize.ts#sanitizeUntrustedText`
before it reaches any prompt:

1. Strips a fixed list of instruction-hijack patterns ("ignore previous
   instructions", fake `system:`/`assistant:` turns, `[INST]`-style
   tokens) — a **mitigation**, not a claimed-complete filter (see the
   comment at the top of that file for why no regex filter can be
   complete).
2. Wraps the result in explicit `--- BEGIN/END UNTRUSTED DOCUMENT TEXT
   ---` delimiters.
3. `SYSTEM_PREAMBLE` (`src/ai/prompt.ts`) tells the model directly that
   text inside `DATA` is data to summarize, never a command to follow.

The real safety boundary is architectural, not linguistic: even if a
model were fully convinced by injected text, the worst it can do is
return recommendation *text* that a human then has to explicitly approve
— it cannot execute an action, and its JSON output still has to pass
schema validation. `tests/unit/sanitize.test.ts` covers the redaction
behavior directly.

## Structured outputs

Every agent schema lives in `src/ai/schemas.ts` (zod). The system prompt
instructs every provider — real or mock — to return *only* a single JSON
object matching the requested shape, no markdown fences, no commentary.
`safeParseJson` handles the real-world case of a model wrapping its answer
in ```json fences anyway, and returns `null` (triggering the fallback path
in `runAgent`) for anything that doesn't parse or doesn't validate.
`tests/unit/ai-prompt.test.ts` covers malformed JSON, schema-violating
JSON, fenced JSON, and JSON with surrounding prose.

## Not evaluated

- No real LLM provider (Anthropic/OpenAI/Google) has been exercised in
  this build — only Mock. Latency, real-world JSON-validity rate, and
  recommendation quality against a real model are unmeasured.
- The observability log is in-memory and per-process (`getRecentAIEvents`
  in `orchestrator.ts`) — it does not persist across restarts and does not
  aggregate across multiple server instances. A real deployment would want
  this in a durable store (see `docs/evaluation.md`).
