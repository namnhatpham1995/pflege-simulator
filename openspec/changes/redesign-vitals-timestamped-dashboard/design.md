# Design

## Context

See `proposal.md` for the motivation and `specs/` for the behaviour contract. What shapes the approach:

- The first change is built and deployed (Next.js App Router, Drizzle on Turso/libSQL, Vercel). Migrations are additive and run by hand against Turso, and the previous release must keep working against a migrated database so a rollback is only "promote the last deployment".
- Today's vitals model is `vital_daily_records`: one row per patient and day with eight nullable columns, a `version` column and an expected-measurement table beside it. The chart (`src/lib/chart-segments.ts`), table, cell editor, warning and the `src/state/vital-view.tsx` store all assume that shape.
- Care reports already store `observed_date` and `observed_time` as local wall-clock strings, and `src/lib/date.ts` already has `nowInBerlin`, `isValidTime`, `addDays` and `compareDates`. The new entries follow the same convention rather than introducing timestamps.
- The only session type left is the teacher's. `sessions` and `care_report_revisions` carry `CHECK (actor_type IN ('group','teacher'))`, which SQLite cannot relax without rebuilding the table.
- The class is small and the data is invented. Correctness of the interaction rules matters more than throughput; the isolation guarantees of the first change are deliberately dropped (see Risks).
- Development is on Windows: scripts use Node APIs; `drizzle-kit migrate` currently exits 1 without a message against Turso, while the app's own `runMigrations` works.

## Goals / Non-Goals

**Goals:**

- A data model where a value, its kind and its clock time are one row, so "all weights this week in time order" is a plain query.
- Chart geometry and series building as pure functions with table-driven tests, as in the first change, so "solid, positioned by time, one series never affects another" is proved, not observed.
- One shared hover/focus state between the entry rows and the chart markers.
- A migration that is additive and reversible by redeploying the previous release.
- Less code than before: the table, cell editor, warning, policy and group-login paths are deleted, not parked.

**Non-Goals:**

- Editing entries, undo, bulk import, export or realtime updates.
- A new identity scheme for students (no names, no cookies, no per-visitor attribution).
- Dropping the superseded tables or converting old daily records (a follow-up change).
- Inspecting the chart itself by hover; interaction starts from the value boxes.

## Decisions

### D1 — One row per value (long format), blood pressure paired by `submission_id`

```
vital_entries(
  id TEXT PK,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  kind TEXT NOT NULL CHECK (kind IN ('systolic','diastolic','pulse','temperature',
                                     'weight','height','pain','glucose')),
  value REAL NOT NULL,
  observed_date TEXT NOT NULL,          -- YYYY-MM-DD, Berlin wall clock
  observed_time TEXT NOT NULL,          -- HH:MM, 24 h
  submission_id TEXT NOT NULL,          -- shared by the two rows of one blood pressure save
  created_at TEXT NOT NULL)
INDEX vital_entries_patient_when (patient_id, observed_date, observed_time, created_at)
INDEX vital_entries_submission (patient_id, submission_id)
patients.date_of_birth TEXT NULL        -- YYYY-MM-DD
```

Why not a wide row per timestamp (eight nullable columns): almost every row would have one value filled, per-kind listings would filter NULLs, and "no entry" would again be a nullable column, which is what the spec now forbids. A long table makes `Empty is never zero` structural: absence is a missing row. No `version` column, because entries are immutable.

`submission_id` is only needed so a blood pressure pair is created and deleted as one unit; single-value saves use their own id. Why not a `pair_id` only for blood pressure: one rule for every kind is simpler to test.

`value REAL` holds integers exactly; integer kinds are validated as integers before the insert, so the column type does not need to enforce it. A CHECK on pain (0–10) is not repeated in SQL; the plausible ranges live in one place, `src/lib/validation/vitals.ts`.

### D2 — Additive migration, legacy tables left in place

Migration `0001` creates `vital_entries` and runs `ALTER TABLE patients ADD COLUMN date_of_birth TEXT`. `vital_daily_records`, `measurement_requirements` and `student_groups` stay, unread, so the previous release still runs against the migrated database. The class-data reset keeps clearing `vital_daily_records` until the tables are dropped in a later change.

Alternatives: convert old daily records at an invented time of day (fabricates data), or drop the old tables now (breaks rollback). The live database holds no class data yet, so neither is needed.

### D3 — Times are strings end to end

Date and time are `YYYY-MM-DD` and `HH:MM` strings in the form, the API, the table and the chart; no `Date` object carries them across a timezone. Positions on the chart come from integer minutes since the window start, computed from the strings with the existing UTC-noon day arithmetic in `lib/date.ts`. Week windows use a new `startOfWeek` (Monday) helper in the same file. A time skipped by a clock change (02:30 on 2027-03-28) is accepted because nothing converts it.

Why not store UTC instants: the spec asks for what the student typed to be what everyone sees, and the first change already chose strings for reports for the same reason.

### D4 — API shape

| Method and path | Who | Purpose |
|---|---|---|
| `GET /api/patients/{id}/vitals?from=&to=` | anyone | entries in the inclusive range (max 31 days), ordered date, time, created |
| `POST /api/patients/{id}/vitals` | non-teacher | `{ category, values, date, time }`, strict schema; returns the created entries |
| `DELETE /api/patients/{id}/vitals/{submissionId}` | non-teacher | deletes the unit; 404 if absent |
| `PATCH /api/patients/{id}` | teacher | `{ displayName?, dateOfBirth? }`; `null` clears the date of birth |

`category` is one of the seven UI categories; `values` carries `systolic` and `diastolic` for Blutdruck and exactly one key for every other category. Unknown keys, including `shift`, are rejected by a strict object, as before. All writes go through the existing `serialiseWrites` queue and one transaction, and the error body keeps the existing `{ error: { code, message, fields } }` shape. The per-day route (`vitals/[date]`) and `requirements` route are removed.

A separate read lists recent entries for the Vitalwerte tab (newest first, 50 per category, a blood pressure pair shown once); it is internal to the page and not part of the public contract.

### D5 — Visitors without a session are anonymous students

`requireActor` throws when there is no session; the patient routes now call a `resolveVisitor` that returns the teacher actor for a valid teacher session and an anonymous student actor otherwise. `requirePatientAccess` checks only that the patient exists. Write services call `assertStudentWrite(actor)`, which returns 403 for the teacher. Teacher-only routes keep `requireTeacher`, and with no session they now answer 401.

The anonymous actor is stored as `actor_type = 'group'`, `actor_id = 'patient:<patientId>'` in audit and revision rows. Reusing `'group'` is a compromise: the CHECK constraints cannot change without rebuilding tables, and the value only ever means "someone using this patient's workspace". The audit text says "anonymous student". Cleaning this up belongs with dropping the legacy tables.

Removed: `loginWithGroupCode`, the group branch of `/api/auth/login`, the group mode of the login form, group resolution in `session.ts`, the access-code seeding and `--rotate`. Kept: the teacher password login, its two-key throttle (client address and a teacher key), HttpOnly sessions and `Origin` checks. `sessions.actor_type` is only ever `'teacher'`.

The teacher password stays an environment-supplied scrypt hash. `scripts/hash-password.ts` already accepts any non-empty value, so a short phrase needs no code change, only a new `TEACHER_PASSWORD_HASH`.

### D6 — Dashboard state lives in the URL

`/patients/{id}/dashboard?view=day|week&date=YYYY-MM-DD`. The server component reads the window, loads the entries once through the service layer and renders; the view toggle, previous/next and the date control navigate by changing the query. Why not client state: the page is server-rendered anyway, links are shareable, the teacher and students see identical windows, and the old `vital-view` store (hover date, selection, optimistic cells) disappears. The only client state left is the hovered entry id, kept in a small context shared by the chart and the rows.

### D7 — Chart: custom SVG, four series, three scales, solid lines

The chart stays a hand-written SVG component. X is minutes since window start (1440 for Tag, 10080 for Woche). The left axis (`mmHg`) is shared by systolic and diastolic, the right axis is `Schläge/min`, and a second right axis offset inward is `°C` for temperature. Each scale uses a fixed default range (mmHg 40–200, Schläge/min 40–180, °C 34–42) that expands to include any entry outside it, so a view is comparable day to day but never clips a value.

Series building collapses to "sort by time, join consecutive points with one solid path, a single point is a marker only". `buildSeriesSegments` and its solid/dashed classification are deleted. Colours: dark blue, light blue, red as before, plus orange for temperature, all checked against the existing contrast tokens.

Alternatives: normalise all series to 0–100% (axis labels lose meaning); stacked panels per unit (clearer on a phone, but the spec and the request describe one chart). Stacked panels are the fallback if the three-axis chart is unreadable below about 640 px (see Risks).

### D8 — Rows and hover

Eight rows in fixed order. Each box is a focusable `<button type="button">` whose accessible name is `Puls 82 Schläge/min, 12.11.2026 09:15`; hover, focus and tap set the shared hovered id and show a tooltip with `TT.MM.JJJJ HH:MM` (`aria-describedby`, `role="tooltip"`). Chart markers read the same id to draw the highlight, so only the four charted kinds ever match a marker. A tap on touch toggles it and a tap outside clears it. Rows list the entries of the visible window only, which keeps reads bounded; they wrap, and scroll horizontally if a week is dense. There is no hover on the chart itself.

### D9 — Vitalwerte tab

Seven category tabs (`role="tablist"`). Each form holds its inputs, the existing day-parts picker and calendar popover for the day, an `HH:MM` text input and `Speichern`. Day and time default to `nowInBerlin()` when the form opens and are reset to it after a successful save. Input parsing reuses the German-decimal preprocessing in `VITAL_RULES`. The page shows an entry as saved only from the server response, keeps the typed values on a failed save, and offers deletion through the existing dialog component with an explicit confirmation. The teacher sees the entry list without the form or delete buttons.

### D10 — Patient details

`PATCH /api/patients/{id}` accepts a strict `{ displayName?, dateOfBirth? }`, trims the name (1–100 characters), validates the date with `isValidCalendarDate`, rejects dates after today in Berlin or before 1900-01-01, and writes the change and an audit row (`entity_type = 'patient'`, before and after values) in one transaction. The teacher edits it from the patient header through a dialog that reuses the day-parts picker with a clear option. The seed keeps `onConflictDoNothing`, so it never overwrites a teacher's edit, and it no longer creates groups.

### D11 — Delivery order

Task groups 1 to 4 (data, access, entries API, pure helpers) have disjoint files and can run in parallel after group 1's migration lands; groups 5 to 8 (shell, dashboard, Vitalwerte tab, teacher) build on them, with the dashboard and the Vitalwerte tab independent of each other. Obsolete files are deleted in the group that replaces them so each group leaves the suite green.

## Risks / Trade-offs

- **Anyone can write to any patient** → accepted by the user for a practice tool with invented data. Mitigations kept: same-origin check on every write, teacher read-only with a throttled login, audit rows for every create and delete, and the teacher's class-data reset. No per-visitor attribution is possible.
- **Vandalism or accidental deletion by another visitor** → deletion is confirmed and audited, and the teacher can reset; there is no undelete. If it becomes a problem, a soft-delete column is an additive follow-up.
- **Three-axis chart is hard to read on narrow screens** → render at least 320 px wide with horizontal scroll first; if it is still unreadable, switch below 640 px to stacked panels sharing the time axis (same data, same hover state).
- **Dense weeks** (many entries per day) → markers overlap and rows grow; boxes wrap and the row scrolls. Not capped in this change.
- **Anonymous actor stored as `'group'`** → documented in D5 and cleaned up with the legacy tables; audit readers must treat `patient:` ids as "anonymous student".
- **`drizzle-kit migrate` exits silently against Turso** → release migrates with the app's own `runMigrations` script; a task fixes or replaces `npm run db:migrate` so the runbook is accurate.
- **Specs modify requirements that are not in `openspec/specs/` yet** → this change cannot be archived until `add-nursing-documentation-simulator` is archived; the deltas were checked mechanically against its headers.
- **Existing tests encode the old model** (table, cell editor, warning, expected fields, group login) → they are rewritten or deleted with the code they cover, not left skipped.

## Migration Plan

1. Archive `add-nursing-documentation-simulator` (its two open tasks are the production smoke, now done, and the backup rehearsal, still open; record that explicitly).
2. Generate migration `0001`, apply it to the local files and run the full suite.
3. Before release, take a backup of the Turso database if class data exists (`docs/runbook.md`), then apply `0001` to Turso with the app migrator. The running release keeps working because the change is additive.
4. Deploy the new release to production and smoke-test: Start, open a patient, save one value of each category, check the Dashboard day and week views, delete an entry, sign in as teacher, edit a name and date of birth, confirm the teacher sees no input controls.
5. Rollback: promote the previous deployment in Vercel; `vital_entries` and `date_of_birth` stay and are ignored by the old release. Data entered through the new release stays in `vital_entries`.
6. A later change drops the legacy tables and the `'group'` actor workaround.
