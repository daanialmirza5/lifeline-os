# Threat Model (STRIDE)

Scope: the Lifeline OS prototype as built — a single Next.js deployment,
SQLite in dev/test, synthetic data only. Threats assume an attacker with
network access to the deployed app; a Postgres production deployment adds
its own network-boundary considerations not covered here.

| # | Category | Threat | Mitigation in this build | Residual risk |
|---|---|---|---|---|
| 1 | **S**poofing | Attacker submits requests with a forged/stolen session cookie | JWT signed with `AUTH_SECRET` (HS256), `httpOnly` cookie prevents JS exfiltration via XSS | `AUTH_SECRET` is a single shared secret with no rotation mechanism; a leaked secret compromises all sessions until rotated manually |
| 2 | **S**poofing | Login brute-forcing | Rate limiting on `/api/*` (120 req/min/IP, `src/proxy.ts`) | Per-instance/in-memory — a distributed attack across many IPs, or restarting the limiter's process, isn't meaningfully throttled; no account lockout |
| 3 | **T**ampering | Client sends a role/patientId not their own to escalate privilege | Every mutating route re-derives the actor from the verified session (`requireRole`/`requireSession`), never trusts a client-supplied role or user id | None identified for role-spoofing specifically |
| 4 | **T**ampering | Concurrent edits silently overwrite each other (lost update) | Optimistic concurrency on `Task.version` (both online `ConflictError` and offline `SyncOperation` conflict) and on `CareJourney.state` itself (`transitionJourney`'s `updateMany({ where: { id, state: from } })` compare-and-swap) | `CareObligation`/`AIRecommendation` don't use version checks, protected instead by their own status-guarded lifecycle (e.g. `decideRecommendation` rejects a second decision on a non-`SUGGESTED` row) — narrower than a real version counter but closes the same class of lost-update for their specific mutation paths |
| 5 | **R**epudiation | A clinician denies having approved a recommendation | Append-only `AuditEvent` records actor, action, before/after state, timestamp for every decision | Audit log is only as trustworthy as the database — no cryptographic tamper-evidence (e.g. hash chaining) in this build |
| 6 | **I**nformation disclosure | A `CLINICIAN` views a patient outside their care team | `requirePatientAccess` (`src/lib/authorization.ts`), checked in every patient-scoped read/write path and enforced inside service functions rather than only at each call site; list views use `accessiblePatientWhereClause` so an inaccessible patient is never fetched, not just hidden after the fact — see `docs/security.md` "Authorization" | The Tasks list and the unscoped Documents list still show cross-patient metadata (title/patient name, not full records) regardless of care-team membership — acting on a specific item IS checked; only those two lists' membership isn't filtered yet (documented, not silently assumed) |
| 7 | **I**nformation disclosure | Structured API error leaks internal detail (stack trace, SQL) | `apiError()` (`src/lib/api-helpers.ts`) returns only `{ error: { code, message } }`; unhandled errors log server-side and return a generic message | None identified |
| 8 | **I**nformation disclosure | AI provider API keys leak via logs or client bundle | Keys read server-side only from `process.env`, never passed to client components; `.env` gitignored | The AI observability log (`/settings`) shows provider/model/latency but not prompt/response content, by design — but is entirely in-memory and unauthenticated *within* the admin role (any `ADMIN` sees all AI call metadata) |
| 9 | **D**enial of service | Flooding `/api/sync` with large batches | `syncOperationSchema` batch capped at 100 operations per request (`src/app/api/sync/route.ts`); rate limiter applies | A single 100-operation batch with large payloads isn't separately size-capped beyond zod's string-length limits on individual fields |
| 10 | **D**enial of service | Oversized document upload / AI prompt | `sanitizeUntrustedText` truncates to 8000 chars before it ever reaches a prompt; the upload route's `rawText` field is capped at 20000 chars via zod | No file-upload size limit exists because this build only accepts pasted text, not binary files (see `docs/architecture.md`/README limitations) |
| 11 | **E**levation of privilege | **Prompt injection**: a malicious document tricks an AI agent into producing a harmful recommendation, which then executes without review | `sanitizeUntrustedText` + explicit untrusted-data delimiters + system-prompt instruction to treat `DATA` as data only (`docs/ai-architecture.md`) — but the actual safety boundary is architectural: even a fully-hijacked agent can only produce recommendation *text*, which stays `SUGGESTED` until a human explicitly approves it, and must still pass schema validation | A sufficiently clever injection could still produce a *plausible-looking but wrong* suggestion that a careless human approves — the mitigation is human review quality, not a technical control; `tests/unit/sanitize.test.ts` only covers pattern-based redaction, not semantic manipulation |
| 12 | **E**levation of privilege | Malformed/adversarial LLM JSON output corrupts application state | `safeParseJson` validates every agent response against its zod schema before use; failure → safe fallback, never a partial write | None identified — this was explicitly designed against (spec section 33) |
| 13 | **T**ampering | Replayed sync operation applied twice (double-charge-style bug) | `operationId` uniqueness is the idempotency key; a retried operation returns the stored outcome without reapplying (`docs/offline-sync.md`) | None identified — covered by `tests/integration/sync.test.ts` |
| 14 | **T**ampering | Duplicate/replayed sync operations from a compromised client flood the `SyncOperation` table | Rate limiting + batch cap (see #9) | No per-user quota on total queued/synced operations |

## Explicitly out of scope for this prototype

- Network-layer threats (TLS termination, DDoS at the infrastructure
  level) — assumed handled by whatever platform this is deployed behind.
- Postgres-specific threats (connection string exposure, row-level
  security) — this build only runs against SQLite; see
  `docs/architecture.md` for the documented-but-unverified Postgres path.
- Physical/device security for a clinician's browser session.
