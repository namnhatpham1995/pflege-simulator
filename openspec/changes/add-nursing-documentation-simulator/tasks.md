# Tasks

Delivery contract: one numbered group = one branch = one independently mergeable PR. A worker gets a whole group. Do not tick or edit tasks outside the group named in the prompt. Only Group 1 may change the frozen files or add a migration; every other group that needs such a change reports `BLOCKED` instead of editing.

| Group | Branch | Runs in | Depends on |
|---|---|---|---|
| 1 Foundation | `feat/foundation` | W0, serial | — |
| 2 Access & shell | `feat/access-shell` | W1 | 1 |
| 3 Vitalwerte data | `feat/vitals-data` | W1 | 1 |
| 4 Date picker | `feat/date-picker` | W1 | 1 |
| 5 Visualisation | `feat/vitals-visualisation` | W1 | 1 |
| 6 Pflegebericht | `feat/pflegebericht` | W1 | 1 |
| 7 Teacher console | `feat/teacher-console` | W2 | 1, 2 |
| 8 Integration & release | `feat/vitalwerte-integration` | W2 | 2–7 |

Every group ends with `Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT`, a two-sentence summary, the files it touched, and its test output. Group 8 is the only group that runs the cross-surface suite; every earlier group runs its own checks.

## 1. Foundation (G0) — serial, blocks every other group

Owns: the scaffold, the whole schema and its single migration, the seed, the shared libraries, the UI primitives, the test harness, the worktree script and `docs/parallel-work.md`. Acceptance: `pnpm verify` is green on an empty app, and a second checkout can start on its own port and database without touching the first.

- [x] 1.1 Initialize the Next.js App Router project on TypeScript strict with Tailwind and the `src/` layout, and verify `pnpm build` succeeds on the default page
- [x] 1.2 Add the runtime and test dependencies from `design.md` D13 and verify `pnpm typecheck` and a trivial Vitest run pass with the lockfile committed
- [x] 1.3 Add `.env.example`, `.gitignore` entries for `.local/`, `*.db*`, `.worktrees/` and `plans/`, and a Zod-validated `src/lib/env.ts`; verify a unit test rejects a missing `SESSION_SECRET` and a missing `TEACHER_PASSWORD_HASH`
- [x] 1.4 Write the complete Drizzle schema from `design.md` D2, including all checks, foreign keys, indexes and the `(patient_id, date)` unique constraint, and generate migration `0000`; verify `pnpm db:migrate` on a fresh `.local/dev.db` and an integration test proves a duplicate day and a pain score of 11 are both rejected by the database
- [x] 1.5 Add `src/db/client.ts` with the `globalThis` singleton and `PRAGMA foreign_keys = ON`, and verify an integration test round-trips a patient and its vitals through a libSQL file
- [x] 1.6 Write the idempotent seed for exactly ten fictional patients, ten groups and the default measurement requirements, printing codes once and writing `.local/group-codes.txt`; verify two consecutive runs keep the same counts, identifiers and hashes
- [x] 1.7 Add `src/lib/types.ts`, `src/lib/api-error.ts` and the uniform error mapper, and verify unit tests map `HttpError` and Zod failures to the documented JSON shape
- [x] 1.8 Implement `src/server/auth/session.ts` and `src/server/services/access.ts` with `requireActor`, `requirePatientAccess`, `requireTeacher` and `assertSameOrigin`, and verify the authorisation matrix in `design.md` D4 with unit tests for 401, 403 and the origin case
- [x] 1.9 Implement `src/lib/date.ts` exactly as specified and verify unit tests for 29 February 2028, 29 February 2027, month lengths, `addDays` across the DST weekends, and a fixed Berlin "today" with a fake clock
- [x] 1.10 Add the root layout, design tokens in `globals.css` and the shared `Button`, `Field` and `Dialog` primitives, and verify a component test renders each and `pnpm build` still passes
- [x] 1.11 Configure Vitest with a per-worker libSQL file and Playwright with a `webServer`, add `pnpm verify` and `pnpm test:e2e`, and verify `pnpm verify` is green on the scaffold
- [x] 1.12 Add `scripts/worktree.mjs` and `docs/parallel-work.md` describing the frozen files, the groups, the waves and the merge order; verify two worktrees receive different `PORT` and `DATABASE_URL` values and the dev server starts in one

## 2. Access & shell (G1) — W1

Owns: `src/app/(auth)/**`, `src/app/api/auth/**`, `src/server/auth/login.ts`, `src/server/auth/rate-limit.ts`, `src/components/login-form.tsx`, `src/app/(app)/layout.tsx`, the patient area shell, `src/components/section-tabs.tsx`, `src/app/api/patients/route.ts`, `src/server/services/patients.ts`, `docs/access.md`. Must not touch: `src/db/**`, `package.json`, `src/server/services/access.ts`, `src/app/globals.css`. Acceptance: a group signs in with its own code, sees only its patient, and a guessed patient id is refused by the API.

- [x] 2.1 Build the login page with student-code and teacher-credential modes and the client form, and verify a component test covers required fields, pending state and the generic error message
- [x] 2.2 Implement `POST /api/auth/login` with scrypt verification, session rotation, cookie attributes and the generic failure; verify route tests for valid code, unknown code, inactive group and an already-present cookie
- [x] 2.3 Implement the database-backed login limiter with the two keys from `design.md` D3, and verify tests for the fifth failure returning 429 with `Retry-After`, a success clearing the key, and a different group unaffected
- [x] 2.4 Implement `POST /api/auth/logout`, idle and absolute session expiry, and the page-level guard; verify a test proves the old cookie is unauthenticated after logout and after the idle period
- [x] 2.5 Implement `src/server/services/patients.ts` and `GET /api/patients` returning the authorised list only, and verify a group sees one patient, the teacher sees ten, and an anonymous call is 401 JSON
- [x] 2.6 Build the authenticated shell with patient header, `Vitalwerte`/`Pflegebericht` tabs and logout, and verify a component test marks the active section and that a layout test redirects an anonymous visitor to the login page
- [x] 2.7 Write `docs/access.md` covering the login flow, session lifetimes and how to generate `TEACHER_PASSWORD_HASH`, and verify the documented command produces a hash that the login test accepts
- [x] 2.8 Run `pnpm verify` for this group and report the result with the files touched

## 3. Vitalwerte data (G2) — W1

Owns: `src/app/api/patients/[patientId]/vitals/**`, `src/server/services/vitals.ts`, `src/lib/validation/vitals.ts`, `src/lib/vitals.ts`, `docs/vitals-api.md`. Must not touch: the schema, `src/app/(app)/**`, `src/components/**` owned by Group 5. Acceptance: one record per day survives a concurrent double save, a stale version is a 409 with the current record, and pain 0 is distinguishable from empty.

- [x] 3.1 Write the field keys, units and plausibility ranges as one exported table and the Zod schema with strict keys, null clearing and comma-decimal preprocessing, and verify unit tests for each range boundary, a comma value, an unknown key and a `shift` key
- [x] 3.2 Implement range reads with the 31-day cap, ascending order and the requirements lookup, and verify integration tests for an inclusive range, a reversed range and an over-long range
- [x] 3.3 Implement the transactional save: version check, create on version 0, merge with stored values, cross-field validation on the merged record, audit insert and the 409 payload; verify integration tests for stale update, concurrent first insert, clearing the last value and pain 0
- [x] 3.4 Wire `GET /vitals`, `GET /vitals/:date` and `PATCH /vitals/:date` and verify route tests for 401, 403 cross-group, 400 invalid date, 400 invalid body and 409 with `current`
- [x] 3.5 Verify an accepted save writes exactly one audit row with the changed fields and previous values, and that a refused save writes none
- [x] 3.6 Write `docs/vitals-api.md` with request and response examples for read, save, clear and conflict, and verify every example against a running route in a test
- [x] 3.7 Run `pnpm verify` for this group and report the result with the files touched

## 4. Date picker (G3) — W1

Owns: `src/components/date-parts-picker.tsx`, `src/components/calendar-popover.tsx`, their test files. Must not touch: `src/lib/date.ts`, any API route, `package.json`. Acceptance: day, month and year are independently editable, 31 February is refused without a request, and keyboard-only operation reaches every control.

- [x] 4.1 Build the controlled picker with three labelled inputs, a day list that follows month length, a twelve-month list and free numeric year entry, and verify component tests for February 2028 (29 days), February 2027 (28) and a typed year 2126
- [x] 4.2 Build the month-view calendar popover that writes a full date and returns focus to its trigger on Escape, and verify component tests for opening, choosing a date, Escape and focus restoration
- [x] 4.3 Implement invalid-combination handling that shows an inline error, emits no change and keeps the previous value, and verify tests for 31 February and for leap days in 2028 and 2027
- [x] 4.4 Add keyboard navigation for the lists and the popover and verify tests using only `tab`, `enter`, `escape` and arrow keys
- [x] 4.5 Add touch and pointer selection and verify the picker still emits one change per interaction in a component test with pointer events
- [x] 4.6 Run `pnpm verify` for this group and report the result with the files touched

## 5. Visualisation (G4) — W1

Owns: `src/components/vital-chart.tsx`, `src/components/vitals-table.tsx`, `src/components/vital-cell-editor.tsx`, `src/components/missing-values-warning.tsx`, `src/lib/chart-segments.ts`, `src/lib/missing-value-policy.ts`, `src/state/vital-view.tsx`, their tests. Must not touch: API routes, the page that composes them, `src/lib/date.ts`. Acceptance: the segment builder reproduces the example table, a full date column highlights from either surface, and a missing required cell is red and announced.

- [x] 5.1 Implement `buildSeriesSegments` and verify a table-driven test reproducing the plan's 10–13 November example plus single point, all null, leading gap and trailing gap
- [x] 5.2 Implement `getMissingFields` against the requirements set and verify tests for an expected blank, an optional blank and a stored 0
- [x] 5.3 Implement `VitalViewProvider` with `selectedDate`, `hoveredDate`, `activeDate = hovered ?? selected`, window fetch with abort and stale-response rejection, and verify unit tests for hover, leave, select and a failed save keeping the typed value
- [x] 5.4 Build the eight-row table with full-height active-column highlight, focus-distinct editor, red missing cells with `Fehlt` and accessible text, and verify component tests for the column highlight, the focus outline and a red cell inside the highlighted column
- [x] 5.5 Build the SVG chart with exactly three series, dual labelled axes, one pointer band per date, markers only for stored values and dashed segments from the builder, and verify component tests for the marker count, the dash count and `mmHg` / `Schläge/min` labels
- [x] 5.6 Build the warning with the German date and field list and `aria-live="polite"`, and verify tests for the missing list, an empty list and an update after a save
- [x] 5.7 Add responsive horizontal scrolling and touch tap and press-and-hold, and verify tests with a narrow container and pointer events
- [x] 5.8 Run `pnpm verify` for this group and report the result with the files touched

## 6. Pflegebericht (G5) — W1

Owns: `src/app/api/patients/[patientId]/reports/**`, `src/server/services/reports.ts`, `src/lib/validation/reports.ts`, `src/app/(app)/patients/[patientId]/pflegebericht/page.tsx`, `src/components/care-report-*.tsx`, `docs/pflegebericht.md`. Must not touch: the schema, `src/components/vitals-*`, the patient layout. Acceptance: several reports coexist on one day, a concurrent edit is a 409, and every accepted edit leaves one immutable revision.

- [x] 6.1 Implement report validation (date, `HH:MM`, shift enum, trimmed 1–10,000 character body) and verify unit tests for whitespace, an unknown shift and an over-long body
- [x] 6.2 Implement create and cursor-paginated chronological listing and verify integration tests for two reports on the same date and shift, newest-first order and a stable tie-break
- [x] 6.3 Implement the edit transaction with version guard, previous-body revision and 409 payload, and verify integration tests for a concurrent edit, one revision per accepted edit and an unchanged body after a refused edit
- [x] 6.4 Wire the three report routes and the revisions route and verify contract tests for 401, 403, 400, 404 and 409
- [x] 6.5 Build the form with native date and time inputs, shift selector, character counter and server-confirmed saved state, and verify component tests for a refused save keeping the text and the counter near the limit
- [x] 6.6 Build the list with date, time, shift, body, edited marker and a read-only history view, and verify component tests for ordering, the marker and the absence of any edit control in history
- [x] 6.7 Compose the Pflegebericht page and verify it renders for an authorised group and refuses another group
- [x] 6.8 Write `docs/pflegebericht.md` on the shift semantics, local date and time storage and the revision behaviour, and verify its statements against the integration tests
- [x] 6.9 Run `pnpm verify` for this group and report the result with the files touched

## 7. Teacher console (G6) — W2, after Group 3

Owns: `src/app/(app)/teacher/**`, `src/app/api/patients/[patientId]/requirements/route.ts`, `src/app/api/admin/reset-class-data/route.ts`, `src/server/services/requirements.ts`, `src/server/services/reset.ts`, `src/components/expected-fields-editor.tsx`, `docs/teacher.md`. Must not touch: the schema, the visualisation components, the vitals service. Acceptance: a group gets 403 on every teacher surface, a policy change alters only that patient's warnings, and a reset keeps patients, groups and codes.

- [ ] 7.1 Implement the requirements read and upsert with audit and verify integration tests for the three defaults, an enabled optional field, a disabled default and a second patient unaffected
- [ ] 7.2 Wire `GET` and `PATCH /api/patients/:id/requirements` and verify a group session gets 403 while the teacher gets the full policy back
- [ ] 7.3 Build the eight-switch policy editor and verify a component test shows the saved state from the server rather than an optimistic guess
- [ ] 7.4 Implement the reset service deleting vitals, reports, revisions and audit in one transaction while keeping patients, groups, codes and requirements, and verify an integration test asserts both the deletions and the survivors
- [ ] 7.5 Wire `POST /api/admin/reset-class-data` with the exact confirmation value and verify 400 without it, 403 for a group and 200 with counts for the teacher
- [ ] 7.6 Build the teacher console listing all ten patients with read-only access to their workspaces and verify a group session is refused on both the page and the API
- [ ] 7.7 Write `docs/teacher.md` on setting expectations, resetting a term and the fact that the teacher cannot edit entries, and verify the documented reset command against a scratch database
- [ ] 7.8 Run `pnpm verify` for this group and report the result with the files touched

## 8. Integration & release (G7) — W2, after Groups 2–6

Owns: `src/app/(app)/patients/[patientId]/vitalwerte/**`, `src/app/(app)/patients/[patientId]/page.tsx`, `tests/e2e/**`, `docs/runbook.md`, `docs/class-pilot.md`. Must not touch: the components it composes, the services, the schema. Acceptance: the full student journey works in a browser, the ten codes work, isolation holds through direct API calls, and a backup restores.

- [ ] 8.1 Compose the Vitalwerte page from the picker, provider, chart, table and warning, and verify `pnpm build` plus a smoke test that the first render contains the selected date above both surfaces
- [ ] 8.2 Add the patient landing redirect and the section navigation, and verify a click-through test lands on Vitalwerte and back on Pflegebericht
- [ ] 8.3 Write the Playwright journey: group login, save a value, reload, confirm persistence, edit to force a 409, and verify `pnpm test:e2e` passes on a clean database
- [ ] 8.4 Add the interaction tests for chart↔table hover sync, the full-column highlight, the red cell inside it, the warning clearing after save, 29 February 2028 versus 2027, and touch tap and press-and-hold
- [ ] 8.5 Add an accessibility pass over the workspace (labels, focus order, `aria-live`, non-colour missing indicator) and verify the checks run in the browser suite
- [ ] 8.6 Write `docs/runbook.md` covering Turso provisioning, migration and seed from a controlled machine, Vercel environment variables, backup with `turso db shell .dump`, restore into a scratch database and rollback; verify each command against the non-production database
- [ ] 8.7 Write `docs/class-pilot.md` with the ten-group check, second-device check, isolation attempt and end-of-term reset, and verify it against a seeded local database
- [ ] 8.8 After the owner confirms the Vercel plan and authorizes deployment, deploy with the Turso resource, run the production smoke (one group login, one save, one report, teacher read), and verify all ten codes and a cross-group API attempt on the deployed URL
- [ ] 8.9 Rehearse the backup and restore into a scratch database and record the result in `docs/runbook.md`
- [ ] 8.10 Run `pnpm verify` and the full browser suite on the final integration branch, and report the commands and exit statuses

## Workflow follow-up

- Archive the change with `openspec-archive-change` once every task is ticked and the class pilot has run.
- Keep the frozen-file list and the group table in `docs/parallel-work.md` current for the next change.
