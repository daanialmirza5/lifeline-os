# Security

> This is a prototype's security posture, sized for a demo running
> synthetic data on a developer machine — not a production hardening
> checklist. Gaps that would matter for a real deployment are called out
> explicitly below and in `docs/threat-model.md`.

## Authentication

- Session tokens are signed JWTs (`jose`, HS256), stored in an
  `httpOnly`, `sameSite=lax` cookie (`secure` in production only, since
  local dev runs over plain HTTP) — `src/lib/auth.ts`. 8-hour expiry.
- Passwords are hashed with `bcryptjs` (cost factor 10) — `hashPassword`/
  `verifyPassword` in `src/lib/auth.ts`. `authenticate()` returns the same
  generic "Invalid email or password" for both an unknown email and a
  wrong password, so login doesn't leak account existence.
- `AUTH_SECRET` is read from the environment (`.env`, gitignored) with no
  hardcoded fallback in application code — `.env.example` ships an
  obviously-fake placeholder value and a reminder to generate a real one
  for any shared environment.
- Demo credentials (`prisma/seed.ts`) are synthetic and clearly labeled as
  such in the login page UI and the README — never treat them as anything
  but a local demo convenience.

## Authorization

Two independent layers, both enforced server-side, never inferred from
the UI:

1. **Role-based** — `src/lib/auth.ts#requireRole` throws `ForbiddenError`
   (HTTP 403) if the session's role isn't in the allowed list; every Route
   Handler and Server Action that mutates state calls it (or
   `requireSession` for read-only routes that only need *a* logged-in
   user). Examples: creating a patient/event/referral/task requires
   `CLINICIAN`/`COORDINATOR`/`ADMIN`; deciding a recommendation requires
   the same; the observability page (`/settings`) requires `ADMIN`
   specifically, both in the page component and independently in
   `/api/observability`.
2. **Patient-scoped** — `src/lib/authorization.ts#requirePatientAccess`
   answers the question role checks can't: given a role that's allowed to
   act in general, is it allowed to act on *this specific patient*.
   `ADMIN` is unrestricted; `PATIENT` is scoped to the single `Patient` row
   linked via `Patient.userId`; `CLINICIAN`/`COORDINATOR` are scoped to
   patients with a matching `CareTeamMembership` row. This is checked
   inside the service functions themselves (`createCareEvent`,
   `createReferral`, `scheduleAppointment`, `createTask`,
   `updateTaskStatus`, `uploadDocument`, `validateDocument`/
   `rejectDocument`, `transitionJourney`, `decideRecommendation`,
   `generateCommunicationDraft`, the two recommendation-generation
   functions) rather than only at each call site, so every current and
   future caller is covered by construction; list views
   (`listPatients`) are filtered via `accessiblePatientWhereClause`
   rather than fetched-then-filtered, so an inaccessible patient is never
   even read out of the database. See `docs/domain-model.md`
   "CareTeamMembership" and `docs/threat-model.md` row 6.

**Known gap, still**: the Tasks list and the unscoped (no `patientId`
query param) Documents list show cross-patient data to any
`CLINICIAN`/`COORDINATOR` regardless of care-team membership — *acting*
on a specific task or document IS checked (both resolve the owning
patient and call `requirePatientAccess`), only list membership isn't
filtered. Noted inline in `src/lib/services/tasks.ts#listTasks` and
`src/app/api/documents/route.ts` rather than silently left unscoped.

## Input validation

Every mutating Route Handler and Server Action validates its input against
a `zod` schema (`src/domain/schemas.ts`) before touching the database —
`request.json()` output is never passed to Prisma directly. Validation
failures return a structured `422 VALIDATION_ERROR`
(`src/lib/api-helpers.ts#apiError`), not a raw exception. Prisma's
parameterized queries (the client never builds raw SQL from user input)
rule out SQL injection by construction, including in the hand-applied
`prisma/bootstrap.ts` path, which only ever executes the static
`migration.sql` file, never user data.

## Rate limiting & security headers

`src/proxy.ts` (Next.js "Proxy", formerly "Middleware") applies:

- A per-instance, in-memory token-bucket rate limiter on `/api/*` (120
  requests/minute per `x-forwarded-for` IP). **Known limitation**,
  documented in the file itself: this resets on restart and doesn't
  coordinate across multiple server instances — a real deployment should
  move this to Redis.
- Baseline headers on every response: `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy:
  strict-origin-when-cross-origin`, `Permissions-Policy` disabling
  camera/microphone/geolocation, and an `x-request-id` for tracing.

**Known gap**: no explicit CSP header is set. Next.js's default script
handling and this app's lack of third-party scripts limit the practical
exposure, but a production deployment should add one.

## Data protection

- No secrets are committed. `.env` is gitignored; `.env.example` documents
  every variable with placeholder/obviously-fake values.
- `AI_PROVIDER` defaults to `mock`, so the app never sends patient data to
  a third-party API unless an operator explicitly configures a key.
- All patient data in this repository is synthetic (`prisma/seed.ts`) —
  see the disclaimer in the README. Never point this seed script or schema
  at real patient data.
- npm audit currently reports 4 high-severity advisories, all in Prisma's
  own dev-tooling dependencies (`mysql2`, `deepmerge-ts`, pulled in for
  multi-database CLI support this project doesn't use) — not reachable at
  runtime by this application, since it only ever talks to SQLite via
  `better-sqlite3`. Documented here rather than silently ignored; revisit
  on the next Prisma upgrade.

## Audit logging

Every consequential action produces an `AuditEvent`
(`src/lib/audit.ts#recordAudit`) — actor, role, action, entity,
before/after state, reason, request id, timestamp. The module exposes only
`recordAudit`; there is no update or delete function, so immutability is
enforced by the module's public API surface. See `docs/domain-model.md`.

## Request IDs

`src/proxy.ts` stamps every response with a `crypto.randomUUID()`
`x-request-id` header. `src/lib/audit.ts#newRequestId` generates a
matching one for audit rows created during the same logical operation
(these aren't currently threaded through from the proxy's header into
service calls — each service call generates its own request id rather
than propagating the one proxy assigned to the HTTP request. A production
version would thread the proxy's id through so a single request's audit
trail is grep-able by one id end to end).

## Dependency posture

Real, working third-party API clients (`src/ai/providers/anthropic.ts`,
`openai.ts`, `google.ts`) are implemented with plain `fetch()` rather than
official SDKs specifically to minimize the dependency surface exposed to
patient-adjacent code paths.
