# Proposal

## Why

Ten nursing student groups need to practise German-language care documentation on fictional patients without touching a real patient record system. Today the only artefact is a written specification: there is no application, no schema and no agreed behaviour for the two things students get wrong most often — a complete daily vital-sign set and a legible, shift-aware care report.

Building it now is cheap because the repository is still empty, so the daily-record rule, the missing-value rule and the group isolation rule can be designed in from the first commit instead of retrofitted into an existing data model. The specification is also precise enough to split into independently shippable slices, which is what makes a parallel build safe.

## What Changes

- Scaffold the Next.js (App Router) + TypeScript + Tailwind application with Drizzle ORM against Turso/libSQL, tracked migrations, and an idempotent seed of exactly 10 fictional patients and 10 assigned groups.
- Add group-code and teacher login with server-issued, HttpOnly sessions, database-backed login rate limiting, origin-checked state-changing requests, and per-request patient authorisation. A group can only ever reach its own patient, including through direct API calls.
- Add the **Vitalwerte** section: exactly one record per patient per calendar day, eight nullable numeric fields, server-side validation, explicit clear-vs-unchanged semantics, and optimistic concurrency with a visible conflict path.
- Add the **date navigation** required by the specification: independent day / month / unrestricted-year controls with selectable lists, a month popover, keyboard and touch operation, and leap-year-correct validation that never shifts a date through timezone conversion.
- Add the **visualisation**: a three-series chart (systolic, diastolic, pulse) with per-series solid segments over adjacent days and dashed segments across days missing that specific measurement, plus a table whose full date column highlights in sync with the chart, red missing cells and a missing-values warning for the active day.
- Make the **expected-measurement policy** a first-class part of v1 instead of a deferred table: `systolic`, `diastolic` and `pulse` are expected by default, the teacher can mark further fields expected per patient, and height/weight stay optional so an unscheduled blank is never reported as a fault.
- Add the **Pflegebericht** section: date, time, shift (`Früh`/`Spät`/`Nacht`) and free text, several reports per patient and day, newest first, with an append-only revision history so an edit never silently replaces what a student wrote.
- Add the **teacher console**: read-only access to all 10 patients and the expected-measurement editor, plus a documented, script-driven class-data reset for the next term.
- Add a repeatable delivery structure: every top-level task group is an independently mergeable PR with an explicit file-ownership boundary, so groups can be handed to separate subagents without two of them editing the same file, migration or shared config.

### Deliberate deviations from the source plan

Each of these is a correctness or testability fix, not a scope increase. The source plan is `nursing_documentation_simulator_vercel_turso_plan.md` at the repository root.

1. **Custom SVG chart instead of Recharts.** The solid/dashed rule is per series and per gap; a small `buildSeriesSegments()` function with unit tests is provable, while a chart library's `connectNulls` behaviour is not.
2. **Report local date + local time instead of one ISO timestamp.** A local wall-clock time is ambiguous or nonexistent twice a year in `Europe/Berlin`. Storing `observed_date` and `observed_time` as separate strings keeps the shift semantics exact and ordering trivial; no timezone conversion is needed to render or sort.
3. **Append-only `care_report_revisions`.** The plan asks for a retained edit history but leaves it to a free-form `change_summary`. A revision row per edit makes the requirement observable and testable.
4. **Expected measurements in v1, per patient only.** The plan calls this "optional later" while the missing-value warning depends on it. Per-date overrides are deferred; per-patient policy covers the classroom need.
5. **Service layer shared by server components and route handlers.** Reads for the first render do not go through HTTP against the app's own API, but both paths pass the same `requirePatientAccess()` check, so authorisation cannot diverge between them.

## Capabilities

### New Capabilities

- `patient-access`: group-code and teacher authentication, session lifecycle, login throttling, and the authorisation rule that a student group reaches only its assigned patient while the teacher reaches all patients.
- `vitalwerte`: the daily vital-sign record — one per patient and calendar day, eight nullable numeric fields, validation ranges, empty-versus-zero semantics, explicit clearing, and version-checked saving.
- `vitals-visualization`: the calendar-date navigation, the three-series chart, the eight-row table, the synchronised active-date highlight, the expected-measurement policy, and the red/announced missing-value treatment.
- `pflegebericht`: shift-aware narrative reports with date and time, multiple entries per day, chronological listing, edit history and version-checked updates.
- `teacher-console`: teacher-wide patient visibility, the per-patient expected-measurement editor, and the class-data reset operation.

### Modified Capabilities

None. The repository has no existing specs.

## Impact

- **New code**: the whole application under `src/` — App Router pages and route handlers, components, Drizzle schema and migrations, seed and maintenance scripts, shared validation and date helpers.
- **New dependencies**: `next`, `react`, `drizzle-orm`, `drizzle-kit`, `@libsql/client`, `zod`, `tailwindcss`, `vitest`, `@testing-library/react`, `@playwright/test` and the small set of typings they require. No chart library, no timezone library and no auth framework.
- **External systems**: one Turso database reached only from the server through `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`; Vercel for hosting. Local development uses a libSQL file instead. No secrets enter the repository and no `NEXT_PUBLIC_` variable ever carries a credential.
- **Data**: 10 fictional patients, 10 groups, their hashed access codes and the members' daily entries. All identities are invented; the system explicitly refuses real patient data.
- **Operations**: migrations and seeding are controlled jobs, never build steps or per-request work; a backup/restore rehearsal and a class-data reset belong to the delivery checklist.
- **Delivery**: eight top-level task groups (foundation, access and shell, vitalwerte data, date picker, visualisation, Pflegebericht, teacher console, integration and release) with a frozen foundation contract and disjoint file sets, so up to five groups can run in parallel.
- **Breaking changes**: none. This is the first implementation in the repository.
