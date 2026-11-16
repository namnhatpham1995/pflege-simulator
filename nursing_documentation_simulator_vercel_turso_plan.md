# Nursing Documentation Simulator
## Implementation plan — Next.js, Vercel and Turso

**Version:** 1.0  
**Prepared:** 16 November 2026  
**Status:** Development specification for MVP  
**Target users:** 10 groups of nursing students, each working with 1 fictional patient; one teacher/admin

---

## 1. Project goal

Create a lightweight German-language web application (*Pflegedokumentation – Simulation*) where 10 student groups independently document measurements and write free-text nursing reports for 10 fictional patients. It is a teaching simulator, not a medical device or a production patient record system.

The initial version is **manual data entry only**. Do not build automatic/random generation of measurements.

### In scope for v1

- 10 seeded fictional patients, one assigned to each group.
- Group access and a teacher/admin overview.
- Two patient sections: **Vitalwerte** and **Pflegebericht**.
- Vitalwerte: **exactly one record per patient per calendar day** (no shift and no time-of-day dimension in this section).
- A date picker with independently editable day/month/year, individually selectable lists, and a popup calendar.
- A single chart containing **three curves only**: systolic blood pressure, diastolic blood pressure, and pulse.
- A table with all 8 Vitalwerte fields; the 5 fields not shown in the chart are numeric only.
- Strong, synchronized full-column highlighting when hovering, clicking or touch-and-holding a date column or associated chart point.
- Red missing-value cells and a warning beneath the chart/table for the active day.
- Solid lines between consecutive valid data points; **dashed lines over dates missing that particular measurement**.
- Pflegebericht: date + time, shift (Früh, Spät, Nacht), and free-text report; multiple reports per patient allowed.
- Persistent storage, validation, role-based data isolation, and safe editing.

### Out of scope for v1

- Random generation or simulated clinical events.
- Real patient data, external EHR integrations, medication administration, automatic clinical interpretation or alarms.
- Attachments, gradebook, analytics dashboard, notifications by email, PDF export, mobile app, offline synchronization.
- A continuously running server or a Railway deployment.

---

## 2. Architecture

```text
10 Student Groups                      Teacher/Admin
       |                                    |
       +-------------- HTTPS --------------+
                           |
                    Next.js on Vercel
             +-------------+-------------+
             |                           |
         Frontend UI                Route handlers
     calendar / table / chart     auth / API / validation
             |                           |
             +------------+--------------+
                          |
                  Drizzle ORM + libSQL
                          |
               Turso Cloud (SQLite/libSQL)
                    managed via Vercel
```

### Technology choices

| Part | Choice | Reason |
|---|---|---|
| Full-stack web app | Next.js (App Router) + TypeScript | Frontend and server API deploy together to Vercel |
| Hosting | Vercel | No standalone backend server required |
| Database | Turso Cloud (SQLite/libSQL) | Persistent remote SQLite-compatible storage |
| ORM + migrations | Drizzle ORM + Drizzle Kit | Typed schema and tracked migrations |
| DB driver | `@libsql/client` | Turso-compatible database access |
| Styling | Tailwind CSS | Responsive, clear visual state styling |
| Graph | Recharts or equivalent custom SVG graph | Three curves, dashed missing intervals, active-day focus |
| Validation | Zod | Shared request validation and data constraints |
| Testing | Vitest + React Testing Library + Playwright | Unit, component and browser interaction coverage |

**Important hosting constraint:** A local `.sqlite`/`.db` file inside a Vercel Function is not suitable as the persistent production database. Vercel's function storage is ephemeral; use Turso remotely in production. Local development may use a local SQLite/libSQL file.

**Credentials:** `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` must be available **only on the server**. Never prefix them with `NEXT_PUBLIC_` and never send them to the browser.

### Suggested repository structure

```text
src/
  app/
    page.tsx                       # Group login / entry
    patients/[patientId]/page.tsx  # Patient workspace
    teacher/page.tsx               # Teacher overview
    api/auth/login/route.ts
    api/auth/logout/route.ts
    api/patients/route.ts
    api/patients/[patientId]/vitals/route.ts
    api/patients/[patientId]/vitals/[date]/route.ts
    api/patients/[patientId]/reports/route.ts
    api/patients/[patientId]/reports/[reportId]/route.ts
  components/
    patient-selector.tsx
    section-tabs.tsx
    date-parts-picker.tsx
    vital-chart.tsx
    vitals-table.tsx
    missing-values-warning.tsx
    vital-cell-editor.tsx
    care-report-form.tsx
    care-report-list.tsx
  db/
    client.ts
    schema.ts
    migrations/
    seed.ts
  lib/
    auth.ts
    date.ts
    validation.ts
    chart-segments.ts
    missing-value-policy.ts
    permissions.ts
    types.ts
  tests/
```

---

## 3. User flow

1. A student opens the public URL and enters the **group-specific access code**.
2. Server identifies the group and its assigned fictional patient. A group may see/edit **only its assigned patient**, even if it guesses another patient ID or directly calls an API URL.
3. Student opens the patient workspace and selects **Vitalwerte** or **Pflegebericht**.
4. In Vitalwerte, select a day using the top date picker, view/edit the eight measurements, and inspect chart/table missing-value highlights.
5. In Pflegebericht, select date/time and shift, enter narrative documentation and save.
6. Entries survive refresh, closing the browser, and re-opening on another computer.
7. Teacher/admin can select any of the 10 fictional patients and review their records.

**Patient list UX:** Teacher sees all 10 patients. Student groups may see a list with only their authorized patient, or a read-only list showing all patient aliases with other patients disabled. Do not grant access based on a frontend-only selection.

---

## 4. Vitalwerte — data and presentation

### Fields (one value per patient and day)

| Field | Data type / unit | Displayed in chart? | Validation example |
|---|---|---|---|
| Blutdruck systolisch | integer, mmHg | Yes, darker blue | Positive integer within configurable plausible range |
| Blutdruck diastolisch | integer, mmHg | Yes, lighter blue | Positive integer; when both present, diastolic < systolic |
| Puls | integer, Schläge/min | Yes, red | Positive integer within configurable plausible range |
| Temperatur | decimal, °C | No | Plausible numeric range |
| Gewicht | decimal, kg | No | Positive number |
| Größe | decimal or integer, cm | No | Positive number |
| Schmerzen | integer, 0–10 | No | Must be 0–10 |
| Blutzucker | integer, mg/dL | No | Nonnegative/plausible numeric range |

All values may be empty (`NULL`). **Empty is not zero**: 0 is a valid pain score, but should never be used for missing measurements.

### Date picker — required interaction

- The selected date appears prominently **above the chart and table**. Default: today's calendar date in `Europe/Berlin`.
- Show **Tag / Monat / Jahr** as three distinct editable controls.
- Clicking **Tag** opens a list of valid days for the selected month and year (28, 29, 30 or 31). Keyboard typing is supported.
- Clicking **Monat** opens a list of 12 months; typing a valid numeric month is also supported.
- Clicking **Jahr** opens a scrollable/selectable year list and supports **free numeric year entry** (not restricted to a small predefined range).
- Calendar icon opens a small month-view calendar popover to choose a full date.
- Keyboard and mouse/touch operation must work; support Tab, Enter, Escape and arrow navigation where applicable.
- Validate dates including leap years, reject invalid combinations (e.g. 31 February), and do not silently shift dates because of timezone conversion.
- Changing the date **loads the existing single daily record** or creates a blank local editing view. Merely selecting an empty day must not insert a database record.
- Selected day is synchronized with a clearly marked table column and the chart focus.

**Date model:** Store daily values as an ISO `YYYY-MM-DD` string (calendar date, not a UTC timestamp). Use `Europe/Berlin` for the user's default date and local display. This avoids date rollover from time zone conversion.

### Vitalwerte table layout

- Columns represent **calendar dates** (for example the selected day plus neighboring days), **not shifts**.
- Rows represent the eight measurements. Column widths adapt responsively; allow horizontal scrolling on narrow screens.
- Clicking any editable measurement cell opens/focuses a numeric input, with unit visible.
- Use a **prominent full-height blue background/border** to indicate the active date column, including the column header and all eight cell positions.
- Missing required cells display an **unambiguous red fill and red border**. They stay red inside the selected blue column. Do not use color alone: display `Fehlt`/an alert indicator and accessible text.
- The actively edited cell has its own visible focus outline distinct from the active column.
- Hovering over any table cell sets the *temporarily highlighted day* to that column; clicking sets the *persistently selected day*.
- When the pointer leaves the table, the temporary highlight disappears and the persistent selected day remains.
- On touch, tapping selects the day; pressing and holding can reveal the same selection/highlight before editing.

### Chart layout (exactly 3 curves)

- **Curve 1:** systolic blood pressure, dark blue.
- **Curve 2:** diastolic blood pressure, light blue.
- **Curve 3:** pulse, red.
- **X axis:** calendar date, matching the table columns.
- **Y axes / values:** BP in mmHg and pulse in beats/min. Use clearly labeled, understandable scales (e.g. dual axes when appropriate); do not imply that units are interchangeable.
- Chart markers show only genuine entered values. Hover tooltip shows selected date and recorded BP/pulse values, with missing fields identified.
- Hovering over a chart point or the column's interactive chart region highlights that **same date** throughout the table. Highlight available chart markers for that date; missing ones must not be fabricated.
- Chart and table share the same state for `hoveredDate` and `selectedDate`:
  `activeDate = hoveredDate ?? selectedDate`.

### Curve connections and missing dates

Calculate lines **independently for each of the three series**:

1. Take actual non-null values and sort them by date.
2. Connect two consecutive available values using a **solid line** if they are on adjacent calendar dates.
3. Use a **dashed line** if one or more whole calendar dates between them are missing that **specific measurement**, even if a different measurement is available on the intermediate day.
4. A single point is shown as a marker, without a line. A missing point remains absent.
5. Never draw a fake numeric point on missing dates and never let a missing diastolic value interrupt the systolic or pulse curves.
6. Prefer explicit custom SVG segments or Recharts series segmentation to guarantee correct solid/dashed behavior. Do not assume a simple `connectNulls` prop implements this rule.

**Example:**

| Date | Systolisch | Diastolisch | Puls |
|---|---:|---:|---:|
| 10.11 | 120 | 80 | 72 |
| 11.11 | 125 | — | 78 |
| 12.11 | 130 | 85 | — |
| 13.11 | 128 | 82 | 80 |

Expected: systolic is solid throughout; diastolic is dashed from 10.11 to 12.11; pulse is dashed from 11.11 to 13.11. Other segments are solid.

### Missing-value warnings

- Show a clearly visible notification **directly below the chart**; it should remain visible while interacting with the selected day's table (if necessary, also repeat/anchor a small summary under the table).
- Example: `12.11.2026: Fehlende Werte: Puls, Temperatur, Schmerzen`.
- Missing cells use **red fill and border**, not just a faint background.
- Warning refreshes immediately after a successful save and when a different date becomes active.
- Distinguish **expected but missing** from **not scheduled/optional** for clinical correctness. Suggested initial configurable `expectedFields` per patient/date: `systolic`, `diastolic`, `pulse`; teacher can enable additional expected fields as needed. For height and weight, an unscheduled empty cell should not be treated as an error by default.
- If the requested classroom exercise requires all eight measurements on every day, teacher can set all eight to `expected`; then all blank cells are red and appear in the warning.
- Never auto-fill missing values.

**Save behavior:** Save an edited field explicitly (Enter/Save), show a successful state, and refresh table/chart/warning from the authoritative server state. Do not claim that a value was saved before the server confirms it.

---

## 5. Pflegebericht — separate section

- Keep this independent from Vitalwerte; **only Pflegebericht has shifts**.
- Inputs: date (default today), time (default current `Europe/Berlin` time), shift (`Früh`, `Spät`, `Nacht`), free-text documentation.
- Support several entries for the same patient and day, including the same shift.
- Display reports in chronological order, newest first, with date, time, shift and text.
- Permit edits according to permissions and retain an edit/audit history. Avoid silently replacing older reports.
- Text entry is free-form. Provide a useful multiline field and visible save confirmation; do not generate or assess content using AI in v1.

---

## 6. Database model (Turso/libSQL)

Use one shared database for 10 fictional patients. Do **not** create 10 separate Turso databases; patient/group isolation belongs in the authorization layer.

### Core tables

**`patients`**
- `id` TEXT PRIMARY KEY (UUID or stable opaque ID)
- `display_name` TEXT NOT NULL (fictional alias)
- `created_at` TEXT NOT NULL

**`student_groups`**
- `id` TEXT PRIMARY KEY
- `display_name` TEXT NOT NULL
- `patient_id` TEXT NOT NULL REFERENCES `patients(id)` UNIQUE (one group per patient)
- `access_code_hash` TEXT NOT NULL (never store plaintext group codes)
- `is_active` INTEGER NOT NULL DEFAULT 1

**`vital_daily_records`**
- `id` TEXT PRIMARY KEY
- `patient_id` TEXT NOT NULL REFERENCES `patients(id)`
- `date` TEXT NOT NULL (`YYYY-MM-DD`)
- `systolic_mmhg` INTEGER NULL
- `diastolic_mmhg` INTEGER NULL
- `pulse_bpm` INTEGER NULL
- `temperature_c` REAL NULL
- `weight_kg` REAL NULL
- `height_cm` REAL NULL
- `pain_score` INTEGER NULL
- `glucose_mg_dl` INTEGER NULL
- `version` INTEGER NOT NULL DEFAULT 1
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL
- **UNIQUE (`patient_id`, `date`)** — enforce one Vitalwerte record per patient/day at database level

**`care_reports`**
- `id` TEXT PRIMARY KEY
- `patient_id` TEXT NOT NULL REFERENCES `patients(id)`
- `group_id` TEXT NULL REFERENCES `student_groups(id)`
- `observed_at` TEXT NOT NULL (ISO timestamp with UTC offset/UTC storage)
- `shift` TEXT NOT NULL CHECK IN (`frueh`, `spaet`, `nacht`)
- `body` TEXT NOT NULL
- `version` INTEGER NOT NULL DEFAULT 1
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL

**`sessions`** (if using database-backed sessions)
- `id_hash` TEXT PRIMARY KEY
- `actor_type` TEXT NOT NULL (`student_group` or `teacher`)
- `actor_id` TEXT NOT NULL
- `expires_at` TEXT NOT NULL

**`audit_log`** (recommended from v1)
- `id` TEXT PRIMARY KEY
- `actor_type` / `actor_id` / `patient_id` / `entity_type` / `entity_id`
- `action` TEXT (create/update)
- `change_summary` TEXT or JSON (avoid unneeded duplication of free text)
- `occurred_at` TEXT NOT NULL

**Optional later:** `required_measurement_policy` linked to patient/group and optionally date, for marking expected values without falsely reporting optional measurements as missing.

### Database behavior

- Use parameterized queries/Drizzle; no string-built SQL from user inputs.
- Enable SQLite foreign keys on connections where applicable.
- Add indexes on `(patient_id, date)` and `(patient_id, observed_at)`.
- Use `INSERT ... ON CONFLICT (patient_id, date) DO UPDATE` or transactionally equivalent logic **with version checks**, never create duplicate daily records.
- Protect against concurrent edits with optimistic locking (`version` on every save; return HTTP `409 Conflict` if stale and offer refresh/merge).
- Make database migrations explicit and checked into source control. Seed **exactly 10 fictional patients and group assignments** using an idempotent seed script.

---

## 7. API design

All handlers run on the **server** and validate user identity and the patient-to-group assignment before reading or writing.

| Method | Route | Behavior |
|---|---|---|
| POST | `/api/auth/login` | Verify group code or teacher credentials, issue secure session |
| POST | `/api/auth/logout` | Revoke session |
| GET | `/api/patients` | Return only authorized patients (all 10 for teacher) |
| GET | `/api/patients/:id/vitals?from=YYYY-MM-DD&to=YYYY-MM-DD` | Fetch dated Vitalwerte records |
| GET | `/api/patients/:id/vitals/:date` | Fetch one daily record (or empty response) |
| PATCH | `/api/patients/:id/vitals/:date` | Validate and save changed daily fields; requires expected version |
| GET | `/api/patients/:id/reports` | List reports chronologically |
| POST | `/api/patients/:id/reports` | Create a free-text report with shift and timestamp |
| PATCH | `/api/patients/:id/reports/:reportId` | Update report with version check and audit entry |

An API response should include authoritative `version`, saved data, and a success/error status. Validate numerics and dates on the server, not solely in the UI.

---

## 8. Security, privacy and class setup

- Use **fictional patient identities only**. Never put real patient data in this simulator.
- Generate distinct, sufficiently long **random group access codes** rather than `group1`/`1234`. Hash at rest (e.g. scrypt/Argon2id). Do not put these codes in the Git repository.
- Use an HttpOnly, Secure, SameSite session cookie. Rate-limit login attempts; protect state-changing requests against CSRF as applicable.
- Enforce access control for **every API request**, including direct requests that bypass the UI.
- Teacher credentials must be independent of group codes. Prefer a teacher session with appropriate privileged access and strong credentials.
- Keep Turso auth token and teacher secrets in server-only Vercel environment variables. Never expose credentials in browser bundles, client logs, screenshots or example files.
- Make backups/export and restoration test part of the deployment checklist. Managed remote storage does **not** automatically mean accidental edits can be undone.
- Document a retention/deletion procedure for class data. If account access or other student-identifying information is introduced later, reassess privacy/GDPR requirements before collecting it.

---

## 9. Implementation phases

### Phase A — bootstrap and local database

- [ ] Create Git repository, Next.js + TypeScript + Tailwind project.
- [ ] Install `drizzle-orm`, `drizzle-kit`, `@libsql/client`, `zod`, chart and test dependencies.
- [ ] Configure local database (`file:./local.db`) for development only.
- [ ] Write Drizzle schema and initial migration; include `UNIQUE(patient_id, date)`.
- [ ] Seed 10 fictional patients and 10 assigned groups (idempotent).
- [ ] Add `.gitignore` rules for `.env*`, `*.db`, `*.sqlite`, secrets.

**Done when:** Local development can insert/read patients, vitals and reports after restarting the app.

### Phase B — authentication and patient selection

- [ ] Build group-code login, teacher login, session handling and logout.
- [ ] Show authorized patient list; students can access only their own patient.
- [ ] Add API authorization tests for guessed/unassigned patient IDs.

**Done when:** Group A cannot read or modify Group B's records through either UI or API.

### Phase C — Vitalwerte CRUD and date picker

- [ ] Build 8 measurement fields and typed server validation.
- [ ] Implement independent day/month/year inputs with selectable lists and calendar popup.
- [ ] Implement one record per calendar day; render blank view without creating records.
- [ ] Add API save/update, version conflict handling and visible success/error messages.

**Done when:** Values for a selected date remain after refresh and cannot create same-day duplicates.

### Phase D — interactive chart and missing-value design

- [ ] Build exactly 3 curves: systolic, diastolic, pulse.
- [ ] Add independently computed solid/dashed chart segments over missing dates.
- [ ] Implement shared `selectedDate` and `hoveredDate` state between chart and table.
- [ ] Add strong full-column highlight and red missing-cell highlight, including selected blue columns.
- [ ] Add below-chart missing-value message for active day and accessibility labels.
- [ ] Add responsive horizontal scrolling and mobile press-and-hold/tap behavior.

**Done when:** Chart-to-table and table-to-chart interactions are synchronized, missing values are red and dashed segments are correct.

### Phase E — Pflegebericht

- [ ] Build date/time picker and Früh/Spät/Nacht shift selector.
- [ ] Implement add/list/edit free-text reports and version conflict checks.
- [ ] Add audit logging for edits.

**Done when:** Several reports can exist on the same day and retain correct shift/timestamp.

### Phase F — deployment on Vercel + Turso

1. Push the code to GitHub (without local DB files and secrets).
2. Import the repository into a Vercel project.
3. In the Vercel project, go to **Storage/Marketplace** and install **Turso Cloud** as a **Vercel Native** integration.
4. Provision and connect one Turso resource/database to the project. The native marketplace workflow can be managed through Vercel; a separate provider-site signup is not generally required, although the installation/terms/plan selection must be accepted by the account owner.
5. Verify that the integration supplies `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` as project environment variables. Do not print token values.
6. Pull env vars locally for development only if needed: `vercel link` and `vercel env pull .env.development.local`.
7. Run the tracked database migrations **against Turso** from a controlled local/admin job. Do not run schema creation as part of each web request.
8. Seed 10 fictional patients and group assignments **once**; avoid re-creating records on deployment.
9. Deploy/redeploy the Vercel app. Verify server-side DB reads/writes in production.
10. Test all 10 group codes, teacher access, refresh persistence, concurrent edits, chart interaction and mobile UI.
11. Set up a DB backup/export and perform a recovery rehearsal.

**Important:** Distinguish production Turso from local development DB. Never accidentally migrate or seed the wrong environment.

### Phase G — quality assurance and classroom pilot

- [ ] Verify all 10 groups can log in simultaneously.
- [ ] Verify one-group/one-patient isolation even when manipulating URL/API calls.
- [ ] Refresh browser and switch devices: saved values persist.
- [ ] Select year `2028`, February `29`: valid; `2027-02-29`: invalid.
- [ ] Enter only systolic on 11.11 between complete 10.11/12.11: systolic solid, diastolic/pulse dashed if those are missing on 11.11.
- [ ] Hover chart point 12.11: 12.11 full column gets a **strong** highlight.
- [ ] Hover a table cell 12.11: corresponding chart day/points highlight.
- [ ] An active date's missing **required** cells stay red even inside blue highlighted column.
- [ ] Missing-value warning lists correct fields and disappears once they are saved.
- [ ] Optional/unexpected measurements do not produce clinically misleading missing alerts.
- [ ] Pain `0` is saved and displayed as zero, not treated as missing.
- [ ] Attempt two concurrent saves of an outdated record: one receives a visible conflict, not silent loss.
- [ ] Pflegebericht has shifts; Vitalwerte has **no shifts**.
- [ ] Keyboard-only and touch interactions work, with focus indicators and accessible labels.
- [ ] Automated unit/component/end-to-end tests pass before classroom use.

---

## 10. Acceptance criteria / definition of done

1. One production web URL works with Vercel hosting and a Turso-managed database; Railway is not required.
2. 10 separate groups can safely work on 10 fictional patients with persistent data isolation.
3. Vitalwerte is a **daily** record, with exactly 8 numeric fields and no shift selector.
4. Top date selector supports direct editing/select lists for **day, month and unrestricted year** plus popup calendar.
5. Chart displays **only 3 curves**: BP systolic, BP diastolic and pulse.
6. Missing chart values are omitted; a line skipping a missing date is dashed for that series only.
7. Hover/tap/selection of a date in chart or table highlights the **entire corresponding table column strongly**.
8. Missing required cells are **red** and the chart-area notification lists them accurately.
9. Pflegebericht accepts date, time, shift and narrative text; reports are saved and reload correctly.
10. Production credentials are server-side only; authorization, input validation and version-conflict handling are implemented.

---

## 11. Decisions and assumptions that can be adjusted later

- **Daily required measurements:** For clinically meaningful warnings, default expected measurements to the BP pair and pulse; allow a teacher-defined policy for temperature, weight, height, pain and glucose. If the exercise intentionally requires all eight each day, mark all eight expected.
- **Timeline window:** Start with a 7–14-day horizontally scrollable chart/table centered on the selected date. This is a UI preference, not a database limitation.
- **Chart Y axis:** Explicitly label blood pressure (mmHg) and pulse (beats/min) if using different axes; don't misrepresent units.
- **Saving:** Prefer explicit field Save/Enter with confirmation to avoid accidental writes and make persistence clear to students.
- **Demo data:** Seed patient identity and group assignment only. Do **not** pre-populate random vital measurements; use hand-written sample values solely in automated tests/development fixtures.
- **Deployment plan:** Vercel Hobby currently restricts use to personal/non-commercial use. **Confirm that your intended classroom/institutional use complies with the plan; use an appropriate paid/institutional plan if necessary.** Verify current Turso resource allowances and terms at setup time.

---

## 12. Official implementation references (checked 16 November 2026)

- Turso Cloud, Vercel Marketplace: https://vercel.com/marketplace/tursocloud/database
- Vercel native integrations: https://vercel.com/docs/integrations
- Next.js + Turso + Drizzle starter: https://vercel.com/templates/next.js/turso-starter
- Vercel — SQLite and ephemeral serverless storage: https://vercel.com/kb/guide/is-sqlite-supported-in-vercel
- Vercel Functions: https://vercel.com/docs/functions
- Vercel Hobby plan and restrictions: https://vercel.com/docs/plans/hobby
- Vercel pricing: https://vercel.com/pricing

**Implementation note:** Use the marketplace's conventional `@libsql/client` + `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` approach for this MVP. Do not introduce Vercel Connect, Turso's experimental Vercel package, a separate Railway backend, or a second database unless new requirements justify them.
