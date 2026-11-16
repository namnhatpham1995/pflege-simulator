# Design

## Context

See `proposal.md` for motivation and `specs/` for the behaviour contract. What shapes the approach:

- The repository is empty apart from `README.md` and the source plan, so the schema and the module boundaries can be chosen once and frozen.
- The runtime is Vercel Functions: stateless, short-lived, possibly several instances. There is no process to hold a scheduler, a WebSocket or an in-memory rate limiter.
- Turso is reached over HTTP through `@libsql/client`. Round trips are not free, so a page render must not fan out into per-cell queries.
- The class is small: 10 groups, 1 teacher, 8 numbers per patient per day, a few dozen reports. Throughput is irrelevant; correctness, isolation and provable interaction rules are not.
- Development happens on Windows. Scripts use Node APIs, not shell pipelines.
- Delivery is split across subagents, so the file layout has to make ownership enforceable (see "Parallel delivery model").

## Goals / Non-Goals

**Goals:**

- One server-side authorisation path used by both the first server render and every API mutation.
- Invariants that survive a buggy code path: uniqueness, enum values, version checks and foreign keys live in the database.
- A chart segment builder that is a pure function with a table-driven test, so the solid/dashed rule is proved rather than observed.
- Local development with no Turso credentials and no network dependency.
- Disjoint file sets per task group, a frozen foundation contract, and a documented merge order.

**Non-Goals:**

- Realtime collaboration, presence or push. Two students on the same day get a 409, not a live co-editing session.
- Offline use, service workers, background sync.
- PDF/CSV export, gradebook, notifications, analytics.
- Per-date expected-measurement overrides; policy is per patient in v1.
- Teacher editing or deleting student entries. The teacher role is read-only on patient data.
- Multi-teacher accounts, password reset, email delivery. One credential from the environment is enough for a classroom.
- i18n. The interface is German; code and identifiers are English.

## Decisions

### D1 — App Router with server components for reads, route handlers for writes, one service layer

Reads for the first paint run in server components and call `src/server/services/*` directly. Every mutation is a route handler under `src/app/api/**` that calls the same service functions. Both paths begin with `requirePatientAccess(patientId)`.

Why not route handlers for reads too: it adds a network hop from the server to itself, and the first paint would need a client fetch waterfall. Why not Server Actions: the plan's authorisation tests target explicit API routes with guessed patient IDs, and a documented JSON contract is a better boundary for parallel groups than opaque action IDs. The service layer is what makes both paths safe; the transport is not the security boundary.

Error shape is uniform:

```json
{ "error": { "code": "FORBIDDEN", "message": "…", "fields": { "diastolicMmhg": "…" } } }
```

`code` is a stable enum (`UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `CONFLICT`, `RATE_LIMITED`, `ORIGIN`). `fields` is present only for `VALIDATION`.

### D2 — Schema created once, in the foundation group

All tables and indexes exist after migration `0000`, including tables only later groups use. This is deliberate: parallel agents that each add a migration will conflict on the migration journal and on `schema.ts`. No group after the foundation may add or edit a migration.

```
patients(id TEXT PK, display_name TEXT NOT NULL, created_at TEXT NOT NULL)

student_groups(id TEXT PK, display_name TEXT NOT NULL,
  patient_id TEXT NOT NULL UNIQUE REFERENCES patients(id),
  access_code_hash TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1)

sessions(id_hash TEXT PK, actor_type TEXT NOT NULL CHECK IN ('group','teacher'),
  actor_id TEXT NOT NULL, created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL)
  INDEX sessions_expires_at

login_attempts(key TEXT NOT NULL, window_start TEXT NOT NULL,
  count INTEGER NOT NULL, PRIMARY KEY(key, window_start))

vital_daily_records(id TEXT PK,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  date TEXT NOT NULL,                    -- YYYY-MM-DD
  systolic_mmhg INTEGER NULL, diastolic_mmhg INTEGER NULL, pulse_bpm INTEGER NULL,
  temperature_c REAL NULL, weight_kg REAL NULL, height_cm REAL NULL,
  pain_score INTEGER NULL CHECK (pain_score BETWEEN 0 AND 10),
  glucose_mg_dl INTEGER NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(patient_id, date))
  INDEX vitals_patient_date  -- covered by the unique constraint

measurement_requirements(patient_id TEXT NOT NULL REFERENCES patients(id),
  field TEXT NOT NULL CHECK (field IN (8 names)), is_expected INTEGER NOT NULL,
  PRIMARY KEY(patient_id, field))

care_reports(id TEXT PK, patient_id TEXT NOT NULL REFERENCES patients(id),
  group_id TEXT NULL REFERENCES student_groups(id),
  observed_date TEXT NOT NULL, observed_time TEXT NOT NULL,   -- HH:MM, Berlin wall clock
  shift TEXT NOT NULL CHECK (shift IN ('frueh','spaet','nacht')),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 10000),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL)
  INDEX reports_patient_when (patient_id, observed_date, observed_time, created_at)

care_report_revisions(id TEXT PK, report_id TEXT NOT NULL REFERENCES care_reports(id) ON DELETE CASCADE,
  version INTEGER NOT NULL, body TEXT NOT NULL,
  actor_type TEXT NOT NULL, actor_id TEXT NOT NULL, created_at TEXT NOT NULL,
  UNIQUE(report_id, version))

audit_log(id TEXT PK, actor_type TEXT NOT NULL, actor_id TEXT NOT NULL,
  patient_id TEXT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  action TEXT NOT NULL, changes TEXT NOT NULL,  -- JSON: [{field, from, to}]
  occurred_at TEXT NOT NULL)
  INDEX audit_patient_time (patient_id, occurred_at)
```

Notes:

- `version` starts at 1 on insert. A client that has never seen a record sends `version: 0` for the create case.
- `PRAGMA foreign_keys = ON` is issued per connection; libSQL does not guarantee it by default.
- Audit rows are written only by services, never by routes, and there is no update or delete path.
- `measurement_requirements` is pre-populated by the seed for all 10 patients: `systolic`, `diastolic`, `pulse` expected, the other five optional.

### D3 — Identity: two actor types, one session table

- Group access code: 20 bytes of `crypto.randomBytes` encoded as base32 (32 characters), hashed with `scrypt` and a per-row 16-byte salt, stored as `scrypt$N$r$p$salt$hash`. Comparison uses `timingSafeEqual`.
- Teacher credential: `TEACHER_PASSWORD_HASH` in the server environment in the same encoding, with `TEACHER_DISPLAY_NAME` optional. No teacher row in the database; the session row uses `actor_type = 'teacher'`, `actor_id = 'teacher'`.
- Session token: 32 random bytes, base64url. The cookie carries the token; the database stores `sha256(token)`. A fast hash is correct here because the token already has 256 bits of entropy — scrypt is for the low-entropy access codes.
- Cookie: `pflege_session`, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` when `NODE_ENV === 'production'`. Idle lifetime 8 hours, absolute 7 days. Every authenticated request refreshes `last_seen_at` at most once per 5 minutes to avoid a write per request.
- Login deletes any session referenced by the presented cookie before issuing the new one (fixation).
- `requireActor()` returns `{ type: 'group' | 'teacher', id, patientId? }` or throws `HttpError(401)`.

Rate limiting uses `login_attempts` with fixed windows and a conditional upsert, keyed twice:

| Key | Limit | Why |
|---|---|---|
| `code:<sha256(access code)>` | 5 per 5 minutes | A shared classroom NAT must not lock the whole class because one group guesses |
| `ip:<sha256(address)>` | 60 per 10 minutes | Backstop against enumeration across codes |

Both are checked; exceeding either yields `429` with `Retry-After`. A success deletes the code key's row. The table is pruned opportunistically when a window older than a day is written past.

### D4 — Authorisation matrix

| Surface | Group | Teacher |
|---|---|---|
| Own patient vitals/reports | read, write | read (any patient) |
| Another patient | 403 | read |
| Expected-measurement policy | read (implicit, via warnings) | read, write |
| Teacher console | 403 | read |
| Class-data reset | 403 | write with confirmation |

`requirePatientAccess(patientId)` resolves the patient and returns `{ actor, patient }`. `requireTeacher()` wraps it for policy and reset. Every mutating handler additionally calls `assertSameOrigin(request)`, which compares `Origin` with the request URL's origin and rejects absent or foreign values. There is no CSRF token in v1; `SameSite=Lax` plus an origin check covers the threat model of a classroom app with no third-party embeds.

### D5 — Calendar dates are strings, never timestamps

`src/lib/date.ts` is the only module allowed to construct a date:

```ts
todayInBerlin(): string            // 'YYYY-MM-DD' via Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' })
nowInBerlin(): { date: string; time: string }
isValidCalendarDate(value: string): boolean
daysInMonth(year: number, month: number): number
addDays(date: string, delta: number): string
compareDates(a: string, b: string): number
formatDe(date: string): string     // '12.11.2026'
```

Implementation notes: `daysInMonth` uses `new Date(Date.UTC(year, month, 0)).getUTCDate()`; `addDays` parses the parts and uses `Date.UTC`, then formats with `toISOString().slice(0, 10)`. No `new Date(string)` and no local-time constructor anywhere in the app. The timezone never enters storage; only "what is today" uses Berlin.

### D6 — Vitals writes: merge, validate, compare-and-swap, audit, in one transaction

`PATCH /api/patients/:id/vitals/:date` body:

```ts
{ version: number, values: Partial<Record<VitalField, number | null>> }
```

- `.strict()` rejects unknown keys, which is how a `shift` in a vitals payload is refused.
- Omitted key = unchanged; explicit `null` = clear.
- Decimal strings with a comma are normalised in a Zod preprocess before the numeric check.
- Cross-field rule (`diastolic < systolic` when both non-null after the merge) is evaluated on the merged record, not on the patch alone, so adding only a diastolic still validates against the stored systolic.
- Write is `UPDATE … WHERE patient_id = ? AND date = ? AND version = ?`; zero affected rows means either a stale version or a missing row. For the create case (`version: 0`) the service inserts; a unique-constraint violation is caught and turned into a 409 with the current record. The whole operation runs in `db.transaction()` together with the audit insert.

Response `200` returns the full record and the new version. `409` returns `{ error: { code: 'CONFLICT' }, current: { record, version } }` so the client can show a diff and offer "apply my values" without a reload.

### D7 — Chart: hand-built SVG, pure segment builder

`buildSeriesSegments(points, windowDates)` takes `{ date, value }[]` already filtered to the visible window, sorted ascending, and returns:

```ts
{ markers: Point[], solid: [Point, Point][], dashed: [Point, Point][] }
```

For each consecutive pair of non-null points, `gap = indexOf(b.date) - indexOf(a.date)`. `gap === 1` → solid, `gap > 1` → dashed. A lone point yields a marker and no segment. Each series is computed independently, so a diastolic gap cannot change the systolic path. This is the whole rule, and it is unit-tested with the example table from the plan plus boundary cases (single point, leading/trailing gaps, all null, duplicate dates impossible by schema).

Geometry: categorical x scale over the window dates (equal spacing, no time arithmetic), left y axis in mmHg, right y axis in Schläge/min, both labelled. Missing dates keep their x slot, which is what makes a gap visible rather than compressed.

Interaction: one transparent band `<rect>` per date column across the plot height, `onPointerEnter` → `onHover(date)`, `onPointerLeave` → `onHover(null)`, `onClick` → `onSelect(date)`. Bands, not only markers, satisfy "hovering the column's interactive chart region". The SVG is `role="img"` with a summary `aria-label`; the table is the accessible equivalent, linked with a visually hidden "Daten als Tabelle" anchor. Focusable data points were considered and rejected: they duplicate the table's navigation and complicate roving focus for little gain.

Rendering: `stroke-dasharray="6 4"` for dashed, 2 px strokes, markers 3.5 px radius with a white ring so overlapping BP curves stay distinguishable. Series colours: systolic `#1d4ed8`, diastolic `#60a5fa`, pulse `#dc2626`; the palette is checked for ≥3:1 against the background for non-text graphics.

### D8 — Active date: URL for the selection, local state for the hover

```
selectedDate  ← ?date=YYYY-MM-DD (validated) ?? todayInBerlin()
hoveredDate   ← client state, never persisted
activeDate    = hoveredDate ?? selectedDate
```

The first render is server-side with the selected date. Changing the date updates local state immediately and calls `history.replaceState` so the URL stays shareable without a server round trip; the data for the new 14-day window is fetched from `/api/patients/:id/vitals?from=…&to=…` with an `AbortController`. The previous window stays rendered while the new one loads (no layout jump), and a stale response is ignored by comparing the request key.

`VitalViewProvider` owns `{ selectedDate, hoveredDate, records, requirements, pending, error, conflict }` and exposes `selectDate`, `hoverDate`, `saveField`, `reload`. It is the only file both the chart and the table import state from, which is why it belongs to the visualisation group and not to the page group.

Alternative rejected: a server navigation per date change. It would refetch the whole page, drop hover state and make the picker feel heavy on a classroom laptop.

### D9 — Missing values are policy plus emptiness, computed once

`getMissingFields(record, expectedFields)` returns `expected.filter(f => record?.[f] == null)` and is used by the table cells, the warning and the tests. The client never computes policy; the API returns `requirements` alongside the records so a table render does not need a second request.

Chart series are intentionally independent of policy: the chart plots what exists, the warning and red cells report what should exist. This separation is what keeps a blank optional weight out of the chart and out of the warning while still being editable.

### D10 — Pflegebericht stores wall-clock date and time separately

`observed_date` (`YYYY-MM-DD`) and `observed_time` (`HH:MM`) are stored as typed, in Berlin wall-clock terms. Sorting is lexicographic on the two columns, which is chronologically correct for this format and needs no timezone conversion. A single ISO timestamp was rejected because a Berlin local time is ambiguous on the autumn DST change and nonexistent on the spring change; "14:30 on 25.10" is what the shift handover actually means.

Edit transaction: `UPDATE … WHERE id = ? AND version = ?`; if one row changed, insert a revision with the *previous* body and version. The history endpoint reads revisions ordered by version ascending. No delete in v1.

Pflegebericht uses native `<input type="date">` and `<input type="time">`; the custom day/month/year picker is required for Vitalwerte only. Server-side validation repeats both formats.

### D11 — Teacher console and reset

Policy editor: eight switches, `PATCH /api/patients/:id/requirements` with `{ field, expected }`, upsert plus audit. The response returns the full policy so the UI does not guess.

Reset: `POST /api/admin/reset-class-data` with `{ confirm: "RESET" }`. In one transaction it deletes `care_report_revisions`, `care_reports`, `vital_daily_records` and `audit_log` rows for the ten patients. Patients, groups, codes and `measurement_requirements` survive. A scripted equivalent (`pnpm db:reset-class-data --confirm RESET`) is provided for the operator and uses the same service function, so the UI and the script cannot diverge.

### D12 — Local database, migrations and seed

- `DATABASE_URL` defaults to `file:./.local/dev.db`; `.local/` and `*.db*` are gitignored.
- `pnpm db:migrate` runs `drizzle-kit migrate` (tracked SQL in `drizzle/`), locally or against Turso when `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` are set.
- `pnpm db:seed` is idempotent: fixed UUIDv5-style identifiers derived from a namespace plus the patient slug, `INSERT … ON CONFLICT DO NOTHING` for patients, groups and requirements. Access codes are only generated for groups that do not exist yet, so re-seeding never invalidates a code already handed out.
- Access codes are printed once to stdout and written to `.local/group-codes.txt` (gitignored, mode 0600 where supported). The file is the teacher's copy for the term.
- `src/db/client.ts` memoises the client on `globalThis` in development so hot reload does not open a new connection per edit.

### D13 — Testing layers

| Layer | Tool | What it proves |
|---|---|---|
| Pure units | Vitest | date parsing/leap years, segment builder, validation, missing-field policy |
| Service integration | Vitest + real libSQL file | uniqueness under concurrent upserts, 409 semantics, audit rows, revisions, reset, seed idempotence |
| Route contracts | Vitest invoking handlers with `Request` | 401/403/400/409/429, origin check, JSON error shape |
| Interaction | Playwright | leap-day rejection, chart↔table hover sync, red cells inside the blue column, warning refresh after save, touch tap/hold |
| Manual/class pilot | checklist | 10 groups at once, second device, backup rehearsal |

Integration tests get one libSQL file per worker (`file:./.local/test-<pid>-<worker>.db`), apply migrations, seed, and close the client in `afterAll`. Nothing mocks the database: the uniqueness and version behaviour is what is under test.

### D14 — Parallel delivery model

This is the part that makes the plan splittable. It adapts the VGTN orchestration rules to this repository: one top-level group = one independently mergeable PR, clear file ownership, no parallel edits to the same file, migration sequence or shared config, and a status protocol at the end of every worker's report.

**Frozen foundation contract (owned by G0, read-only for everyone else):**

```
package.json  tsconfig.json  next.config.ts  postcss.config.mjs  tailwind.config.ts
.vscode/  .github/  drizzle.config.ts  drizzle/**  scripts/**
src/app/layout.tsx  src/app/globals.css  src/app/page.tsx
src/db/schema.ts  src/db/client.ts  src/db/migrate.ts  src/db/seed.ts
src/lib/types.ts  src/lib/date.ts  src/lib/api-error.ts  src/lib/env.ts  src/lib/cn.ts
src/server/auth/session.ts  src/server/services/access.ts
tests/setup.ts  vitest.config.ts  playwright.config.ts
```

If a group believes it needs a change here, it does not edit the file: it reports `BLOCKED` with the exact need, and the controller lands the change on the shared base before the group continues. This single rule prevents the most common parallel failure — two agents editing `schema.ts` or `package.json`.

**Groups and ownership:**

| Group | Branch | Owns (write) | May read | Depends on |
|---|---|---|---|---|
| G0 Foundation | `feat/foundation` | the frozen list above, `docs/parallel-work.md` | the source plan | — |
| G1 Access & shell | `feat/access-shell` | `src/app/(auth)/**`, `src/app/api/auth/**`, `src/server/auth/login.ts`, `src/server/auth/rate-limit.ts`, `src/components/login-form.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/patients/layout.tsx`, `src/app/(app)/patients/[patientId]/layout.tsx`, `src/components/section-tabs.tsx`, `src/app/api/patients/route.ts`, `src/server/services/patients.ts` | foundation | G0 |
| G2 Vitalwerte data | `feat/vitals-data` | `src/app/api/patients/[patientId]/vitals/**`, `src/server/services/vitals.ts`, `src/lib/validation/vitals.ts`, `src/lib/vitals.ts` | foundation, `access.ts` | G0 |
| G3 Date picker | `feat/date-picker` | `src/components/date-parts-picker.tsx`, `src/components/calendar-popover.tsx`, `src/components/date-parts-picker.test.tsx` | `src/lib/date.ts`, tokens | G0 |
| G4 Visualisation | `feat/vitals-visualisation` | `src/components/vital-chart.tsx`, `src/components/vitals-table.tsx`, `src/components/vital-cell-editor.tsx`, `src/components/missing-values-warning.tsx`, `src/lib/chart-segments.ts`, `src/lib/missing-value-policy.ts`, `src/state/vital-view.tsx` | foundation, specs | G0 |
| G5 Pflegebericht | `feat/pflegebericht` | `src/app/api/patients/[patientId]/reports/**`, `src/server/services/reports.ts`, `src/lib/validation/reports.ts`, `src/app/(app)/patients/**/pflegebericht/page.tsx`, `src/components/care-report-*.tsx` | foundation, `access.ts` | G0 |
| G6 Teacher console | `feat/teacher-console` | `src/app/(app)/teacher/**`, `src/app/api/patients/[patientId]/requirements/route.ts`, `src/app/api/admin/reset-class-data/route.ts`, `src/server/services/requirements.ts`, `src/server/services/reset.ts`, `src/components/expected-fields-editor.tsx` | foundation, access, existing patient pages (linked, not edited) | G0, G1 |
| G7 Integration & release | `feat/vitalwerte-integration` | `src/app/(app)/patients/[patientId]/vitalwerte/**`, `src/app/(app)/patients/[patientId]/page.tsx`, `tests/e2e/**`, `docs/runbook.md`, `docs/class-pilot.md` | everything | G1–G6 |

`src/app/(app)/patients/[patientId]/page.tsx` is a redirect to the Vitalwerte section and is owned by G7, but G1 creates the route group and the layout. The `.gitkeep` files G0 creates in each group directory are the only shared placeholders.

**Waves (maximum five workers at once):**

```
W0  G0 foundation                     serial, blocks everything
W1  G1  G2  G3  G4  G5                five disjoint groups, any order
W2  G6  G7                            G6 after G2; G7 after G1–G5
```

W2 can start G6 as soon as G1 is merged, without waiting for G2–G5, because G6 only touches the policy, reset and console surfaces. In practice: five agents in W1, then two in W2, with the controller merging and running the full check after each.

**Worktree and resource slots.** The repository has no `pnpm worktree` equivalent, so G0 adds a small `scripts/worktree.mjs`:

```bash
pnpm worktree feat/vitals-data     # creates .worktrees/vitals-data from the current branch,
                                   # writes .env.local with PORT=310N and DATABASE_URL=file:./.local/wt-N.db,
                                   # runs pnpm install
pnpm worktree remove feat/vitals-data
```

Slot `N` is the lowest integer not claimed by an existing `.worktrees/*/.slot` file, so two worktrees never share a port or a database file. Every worktree uses the same PostgreSQL-free stack; nothing is shared except `node_modules` source downloads. On Windows the script uses `node:fs` and `child_process.spawnSync`, never `rm -rf` or `&&` chains that assume a POSIX shell.

**Merge and conflict rules:**

1. Merge order is G0, then W1 groups in any order, then G6 and G7. Each group rebases on the current base before its PR is merged.
2. Only the foundation owns `package.json` and the lockfile. A group that needs a dependency reports it; the controller adds it in a separate `chore/deps-<name>` commit before the group resumes. This keeps lockfile conflicts out of group PRs.
3. Only G0 creates migrations. If a later group needs a column, that is a foundation change request, not an edit.
4. Generated artefacts (`drizzle/meta/**`, Playwright reports, `.next`) are never committed and never owned by a group.
5. A group's PR must be green on its own: typecheck, lint, its unit/integration tests. G7 runs the cross-surface suite.
6. Tailwind classes are the styling contract; no group edits `globals.css` or `tailwind.config.ts`. Shared primitives (`Button`, `Field`, `Dialog`) live in G0's `src/components/ui/**` and are read-only for groups.
7. Every worker returns `Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT`, a two-sentence summary, and the files it touched. `BLOCKED` means stop and report; never widen scope to work around a contract.

**Worker prompt template** (the controller fills this in per group):

```
Task: <group name and its tasks.md items>
Read: openspec/changes/add-nursing-documentation-simulator/{proposal,design}.md,
      specs/<capability>/spec.md, and these files: <exact paths>
May modify: <exact paths from the ownership table>
Must not touch: package.json, lockfile, src/db/**, src/lib/{date,types,env,api-error}.ts,
      src/server/services/access.ts, any file owned by another group
Acceptance: <the group's acceptance lines from tasks.md>
Constraints: no new dependency without reporting BLOCKED; no migration; German UI copy;
      server-side validation only in Zod schemas; no NEXT_PUBLIC secret
Report: plans/<group>/reports/<agent>.md, then Status/Summary/Concerns
```

The `plans/` folder is gitignored; reports are coordination artefacts, not deliverables.

### D15 — API contract (frozen in G0, implemented by groups)

| Method | Path | Actor | Success | Errors |
|---|---|---|---|---|
| POST | `/api/auth/login` | anonymous | 200 `{ actor }` + cookie | 400, 401, 429 |
| POST | `/api/auth/logout` | any session | 204 | 401 |
| GET | `/api/patients` | group, teacher | 200 `{ patients }` | 401 |
| GET | `/api/patients/:id/vitals?from&to` | authorised | 200 `{ records, requirements }` | 400, 401, 403 |
| GET | `/api/patients/:id/vitals/:date` | authorised | 200 `{ record, version }` | 400, 401, 403 |
| PATCH | `/api/patients/:id/vitals/:date` | group | 200 `{ record, version }` | 400, 401, 403, 409 |
| GET | `/api/patients/:id/reports?limit&before` | authorised | 200 `{ reports }` | 400, 401, 403 |
| POST | `/api/patients/:id/reports` | group | 201 `{ report }` | 400, 401, 403 |
| PATCH | `/api/patients/:id/reports/:reportId` | group | 200 `{ report }` | 400, 403, 404, 409 |
| GET | `/api/patients/:id/reports/:reportId/revisions` | authorised | 200 `{ revisions }` | 403, 404 |
| GET | `/api/patients/:id/requirements` | authorised | 200 `{ requirements }` | 401, 403 |
| PATCH | `/api/patients/:id/requirements` | teacher | 200 `{ requirements }` | 400, 401, 403 |
| POST | `/api/admin/reset-class-data` | teacher | 200 `{ deleted }` | 400, 401, 403 |

`before` is a cursor of `observed_date|observed_time|id`; `limit` is capped at 50. Vitals ranges are capped at 31 days. Date parameters are validated with `isValidCalendarDate` before any query.

## Risks / Trade-offs

- **Vercel Hobby is for personal, non-commercial use** → the classroom use may require a paid or institutional plan. Confirm before Phase F; the code is plan-agnostic.
- **Turso round-trip latency on every dynamic render** → one range query per page plus at most one policy query; the initial render is server-side, subsequent windows are client-fetched; no per-cell queries.
- **Two students editing the same day produce frequent 409s** → the conflict response carries the current record, and the UI shows a field-level diff with "meine Werte übernehmen" rather than a dead end. The spec requires this, and the e2e test covers it.
- **DST ambiguity in report times** → local date and time are stored separately and never converted; a nonexistent local time is still a valid literal for documentation purposes, which is the correct classroom semantics.
- **Hand-built SVG chart is more code than a library** → the alternative is unprovable line-style behaviour; the segment builder is ~40 lines and fully unit-tested, and the rendering is a straightforward scale-and-path loop.
- **Scrollable table plus hover sync can cause layout thrash** → the active column is a CSS background on existing cells, not an inserted element; pointer handlers are on the table container with `pointerenter` delegation, and no state update happens during scroll.
- **Parallel agents drift from the contract** → frozen files, explicit do-not-touch lists, one-owner-per-path, and G7 integration as the first place the pieces meet. The controller runs typecheck after each merge, so drift surfaces at the merge, not at the end.
- **libSQL file locking on Windows during parallel tests** → one database file per worker, closed in `afterAll`, and no test watcher in CI mode.
- **Access codes are shown once** → losing `.local/group-codes.txt` means re-seeding cannot recover them. The runbook documents regenerating a single group's code through a script (delete the group's hash row and re-run seed with `--rotate <group>`), which is the only recovery path; this is acceptable for a classroom and avoids storing reversibly encrypted codes.
- **Audit log grows with every save** → 10 groups × 8 fields × a few edits per day is negligible; a term reset clears it. No retention job needed in v1.

## Migration Plan

1. G0 lands migration `0000` and the seed against a fresh local file; both are committed.
2. Create the Turso database, then run `pnpm db:migrate` with production credentials from a controlled machine. Never from a Vercel build or request.
3. Run `pnpm db:seed` once; capture the printed codes into the teacher's offline copy.
4. Set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `TEACHER_PASSWORD_HASH`, `SESSION_SECRET` and `APP_ORIGIN` as Vercel project environment variables (server-only scope).
5. Deploy, then smoke-test one group login, one save, one report and one teacher read.
6. Rollback: redeploy the previous build. Schema changes in v1 are additive only, so a rollback does not need a down migration; a destructive change would require a fresh database and a re-seed.
7. Before the first class, rehearse a dump and restore (`turso db shell <db> .dump > backup.sql`) into a scratch database and verify the ten patients and one saved day.

## Open Questions

None blocking. Three defaults are deliberately chosen and recorded here so no group has to guess: a 14-day visible window (plan suggests 7–14), plausible ranges in `src/lib/validation/vitals.ts` (systolic 50–300, diastolic 30–200, pulse 20–250, temperature 30–45, weight 0.5–400, height 30–250, glucose 10–900), and a report body limit of 10,000 characters. Each is a constant with a test, not a policy engine.
