# Tasks

## 1. Data foundation

- [x] 1.1 Add `vital_entries` (with the two indexes) and `patients.date_of_birth` to `src/db/schema.ts`, generate migration `0001` with `npm run db:generate`, and verify the generated SQL only creates the table and adds the column (no drops, no rebuilds)
- [x] 1.2 Add an integration test in `tests/integration/database.test.ts` that applies all migrations to a scratch file database and verifies the kind CHECK rejects an unknown kind, `NULL` values are refused, two rows with the same patient, kind, date and time are accepted, and the legacy tables still exist
- [x] 1.3 Reproduce why `npm run db:migrate` (drizzle-kit) exits 1 with no message against Turso, then either fix it or point the script at the app's `runMigrations`; verify with a run against a scratch libSQL file and record the cause and the Turso result in `docs/runbook.md`

## 2. Open access and teacher-only login

- [x] 2.1 Add `resolveVisitor` and `assertStudentWrite`, change `requirePatientAccess` to check only that the patient exists, and make teacher-only routes answer 401 without a session; verify with integration tests for anonymous read, anonymous write, teacher write (403), unknown patient (404) and anonymous teacher API (401)
- [x] 2.2 Store the anonymous actor as `('group', 'patient:<patientId>')` in audit and revision rows; verify an integration test reads back that actor for a saved entry and for a report edit
- [x] 2.3 Remove `loginWithGroupCode`, the group branch of `/api/auth/login`, group resolution in `session.ts` and the access-code logic in `src/db/seed.ts` (including `--rotate` and `.local/group-codes.txt`); verify `tests/integration/seed.test.ts` expects ten patients, no groups created and a second run changing nothing
- [x] 2.4 Keep the teacher password login and its throttle, drop the group mode from `src/components/login-form.tsx`, and verify with login tests that a short phrase signs in, a wrong password gets one generic 401, repeated failures get 429 with a retry time and success clears the counter
- [x] 2.5 Rebuild the front page in `src/app/page.tsx` with one primary `Start` button to the patient list and a secondary teacher sign-in link, make the patient list open to everyone, and verify with a component test (no access-code input or button anywhere) and a browser check of the page
- [x] 2.6 Update `docs/access.md`, `docs/class-pilot.md` and `docs/teacher.md` for open student access and the simple teacher password (set with `npm run hash-password -- "<phrase>"` and `TEACHER_PASSWORD_HASH`); verify the documented commands run as written

## 3. Measurement entries service and API

- [x] 3.1 Replace `src/lib/validation/vitals.ts` payload schemas with a strict `{ category, values, date, time }` schema (seven categories, German decimals, existing ranges, `HH:MM` and calendar-date checks, pair rule for Blutdruck); verify with table-driven unit tests for each spec scenario, including pain 0, blank input, unknown field, `shift`, 24:00 and 12:60
- [x] 3.2 Implement `createEntries` (one transaction through `serialiseWrites`, blood pressure as two rows with one `submission_id`, audit row) and `deleteEntries`; verify integration tests for same-minute duplicates, pair atomicity when one value is invalid, concurrent saves both succeeding, delete of a pair, second delete returning 404 and audit rows for create and delete
- [x] 3.3 Implement `getEntriesRange` (inclusive, 31-day cap, ordered date, time, created) and `listRecentEntries` (50 newest per category, pairs shown once); verify integration tests for ordering, equal times keeping creation order, the window limit and a reversed range returning 400
- [x] 3.4 Rewrite `src/app/api/patients/[patientId]/vitals/route.ts` (GET, POST), add `vitals/[submissionId]/route.ts` (DELETE), delete the `vitals/[date]` and `requirements` routes, and verify route tests for status codes, the error body shape, same-origin enforcement and the teacher 403
- [x] 3.5 Rewrite `docs/vitals-api.md` for the new endpoints and payloads; verify each documented `curl` example against the local dev server

## 4. Time and chart helpers

- [x] 4.1 Add `startOfWeek`, `endOfWeek`, `windowFor(view, date)`, `formatDeDateTime` and `minutesFromWindowStart` to `src/lib/date.ts`; verify unit tests for Monday-to-Sunday windows across a month and year end, a leap day and the 2027-03-28 clock change
- [x] 4.2 Replace `src/lib/chart-segments.ts` with a series builder (sort by time, join consecutive points with one solid path, lone point as marker only) and axis-range helpers that expand the default ranges to fit outliers; verify table-driven unit tests for gaps, a single point, independent series, equal times and an out-of-range value
- [x] 4.3 Delete `src/lib/missing-value-policy.ts` and its test; verify `npm run typecheck` shows no remaining import of it

## 5. Workspace shell

- [x] 5.1 Change `src/components/section-tabs.tsx` to the three tabs Dashboard, Vitalwerte, Pflegebericht, make `/patients/{id}` open the Dashboard and add the `dashboard` route segment; verify `tests/component/section-tabs.test.tsx` for order, current-page marking and keyboard reachability
- [x] 5.2 Show the patient name and date of birth (`TT.MM.JJJJ` or `Geburtsdatum nicht angegeben`) in the workspace header and the patient list; verify a component test for both states and a rename becoming visible after reload

## 6. Dashboard

- [x] 6.1 Build the Dashboard page with URL state (`view`, `date`), the `Tag`/`Woche` toggle, previous and next buttons and the reused date controls; verify component tests for the default view, the week label `16.11.2026 – 22.11.2026`, next week and previous day
- [x] 6.2 Replace `src/components/vital-chart.tsx` and `tests/component/vital-chart.test.tsx` with the four-series SVG chart with three labelled axes, time positioning and solid lines, using the helpers from group 4; verify component tests for four distinct series, no markers for uncharted kinds, two entries on one day at different positions, a gap joined by a solid line and an empty window
- [x] 6.3 Build the eight entry rows with focusable value boxes, the date-and-time tooltip, the shared hover context that highlights the matching marker for the four charted kinds, and tap-to-toggle on touch; verify component tests for two weights in order, hover label `12.11.2026 10:33`, marker highlight and restore, no highlight for glucose, keyboard focus and tap dismissal
- [x] 6.4 Confirm the Dashboard has no input, save or delete control and shows no red cells, `Fehlt` text or warnings; verify with a component test and an accessibility scan in `tests/e2e/accessibility.spec.ts`
- [x] 6.5 Delete `src/components/vitals-table.tsx`, `vital-cell-editor.tsx`, `missing-values-warning.tsx`, `src/state/vital-view.tsx` and their tests; verify `npm run typecheck`, `npm run lint` and `npm run test` pass

## 7. Vitalwerte entry tab

- [x] 7.1 Build the seven category tabs with their forms (two inputs for Blutdruck), the reused day picker, the `HH:MM` input defaulting to the current Berlin day and time, and the `Speichern` button; verify component tests for the tab set, input counts, defaults and that typing alone calls no API
- [x] 7.2 Wire saving: keep typed values and show field errors on failure, reset values and now-defaults on success, and refresh the list; verify component tests for a failed save, a successful save and a blood pressure save with one missing value
- [x] 7.3 Add the recent-entries list (50 newest, pairs shown once) with deletion behind the existing confirmation dialog and no edit control; verify component tests for confirm, cancel, pair deletion and the teacher view showing the list without form or delete buttons
- [x] 7.4 Add a browser journey to `tests/e2e/journey.spec.ts`: Start, open a patient, save each category, see the entries on the Dashboard day and week views, hover a box, delete an entry; verify `npm run test:e2e` passes against `file:./.local/e2e.db`
- [x] 7.5 Update `docs/pflegebericht.md` only where it mentions group access and document the Vitalwerte tab in `docs/class-pilot.md`; verify the described steps match the running app

## 8. Teacher console

- [x] 8.1 Implement `PATCH /api/patients/{id}` and the service (trimmed 1–100 character name, optional date of birth between 1900-01-01 and today in Berlin, `null` clears, audit row with before and after values); verify integration tests for rename, set, clear, impossible date, future date, empty name, anonymous 401 and the audit entry
- [x] 8.2 Add the patient-details dialog to the header for the teacher, reusing the day picker with a clear option; verify a component test for validation messages and a browser check that the new name appears in the list
- [x] 8.3 Remove the expected-fields editor, its route, `src/server/services/requirements.ts` and their tests, and make the class-data reset clear `vital_entries` as well as the legacy daily records while keeping patients with their edited details; verify `tests/integration/reset.test.ts` for emptied entries and reports, intact names and dates of birth, refusal without confirmation and 401 without a teacher session
- [x] 8.4 Update `docs/teacher.md` and `docs/runbook.md` (patient details, reset behaviour, no expected-measurement editor); verify the documented reset command against `file:./.local/e2e.db`

## 9. Integration and release

- [x] 9.1 Run `npm run verify` and `npm run test:e2e` on the integrated branch and verify both pass with no skipped or deleted-to-pass tests
- [x] 9.2 Check every scenario in `specs/` against a test or a recorded manual check and list any gap in the task notes; verify no scenario is unaccounted for
- [x] 9.3 After `add-nursing-documentation-simulator` is archived, back up Turso if class data exists, apply migration `0001` to Turso with the app migrator and verify the new table and column exist and the current production release still serves `/login` and the patient list
- [ ] 9.4 Deploy to production and run the smoke from the design's migration plan (Start, save each category, Dashboard day and week, delete, teacher sign-in, edit name and date of birth, teacher sees no input controls); verify each step on https://pflege-simulator.vercel.app and record the result in `docs/runbook.md`
- [ ] 9.5 Rehearse the rollback by promoting the previous deployment in a preview environment against the migrated database; verify it serves the patient list and ignores `vital_entries`

## Workflow follow-up

- Archive `add-nursing-documentation-simulator` first; this change cannot be archived before it.
- Archive this change after production smoke passes, then correct the `## Purpose` text of `vitalwerte`, `vitals-visualization`, `teacher-console` and `patient-access` in `openspec/specs/`, which still describes daily records, missing values, group codes and expected measurements.
- Plan a later change that drops `vital_daily_records`, `measurement_requirements` and `student_groups` and replaces the `'group'` actor workaround.

## Completion notes

- Implemented and verified 2026-11-16: `npm run verify` (typecheck, lint, 207 tests), `npm run build`, `npm run test:e2e` (9 browser tests).
- `npm run db:migrate` now runs `scripts/migrate.ts` with the app migrator because `drizzle-kit migrate` exits 1 without a message against Turso. Verified against a scratch libSQL file; the Turso run was not performed here.
- Verification gaps: `docs/vitals-api.md` examples were exercised through the route tests and the browser journey rather than literal `curl` calls; a rename becoming visible after reload is covered by the teacher browser test.
- Tasks 9.3–9.5 stay open: they need Turso/Vercel credentials, a production backup and the owner's deployment authorization. No production migration or deployment was attempted.
- The change cannot be archived yet: `add-nursing-documentation-simulator` must be archived first, and this change is archived only after the production smoke in 9.4.


## Production notes (2026-11-16)

- 9.3 done with deviations: the older change is not archived yet (its 8.8 and 8.9 are open), and the backup is a JSON export because the Turso CLI is not installed. Migration `0001` is applied; counts are unchanged.
- 9.4 stays open: deployed and smoke-tested (see `docs/runbook.md`), but teacher sign-in, details edit and the teacher no-inputs check were not run because the teacher plaintext password is not available here.
- 9.5 stays open: the previous deployment was only requested directly (`/login` 200, `/api/patients` 401); no promote rehearsal was performed.
