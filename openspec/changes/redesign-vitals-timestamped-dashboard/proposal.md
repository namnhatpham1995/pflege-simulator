# Proposal

## Why

The Vitalwerte section is built around a daily checklist: one record per day, eight cells per column, red "Fehlt" cells, a missing-values warning and an expected-measurement policy. Nursing students do not document that way. They record a measurement when they take it, at a clock time, and often several times a day. The one-record-per-day model cannot hold that, and the matching machinery (column highlight, red gaps, dashed lines across missing days) only exists to compare against a checklist that no longer applies.

The tool is also a practice simulator with fictional patients only, so the group access codes add friction without protecting anything of value.

## What Changes

- **BREAKING** Replace the daily vital-sign record with **timestamped measurement entries**: one value, one measurement kind, one observed date and one observed time (HH:MM). Any number of entries per kind and day is allowed.
- Replace the two-section workspace with **three tabs**: **Dashboard** (new, read-only), **Vitalwerte** (data entry) and **Pflegebericht** (unchanged).
- **Dashboard**: one chart with four series (systolic, diastolic, pulse, temperature) in a **Tag** or **Woche** (Monday to Sunday) view, all lines solid, plus one row per measurement kind listing every entry in the visible window as a value box. Hovering a box shows its date and time; for the four charted kinds it also highlights that point on the chart.
- **Vitalwerte tab**: one tab per measurement category (Blutdruck, Puls, Temperatur, Gewicht, Größe, Schmerzen, Blutzucker), each with its value input(s), a day and an HH:MM time that default to now, and an explicit **Speichern** button. Saved entries can be deleted, not edited.
- Remove every missing-value concept: red cells, `Fehlt` labels, the warning, the per-patient expected-measurement policy and its teacher editor, the synchronised date-column highlight, and dashed gap segments.
- **BREAKING** Remove student sign-in and group access codes. The front page gets a **Start** button that opens the list of all ten patients; anyone can open any patient. The teacher still signs in, with one simple password from the environment, and stays read-only on measurements and reports.
- Let the teacher **edit patient details** (name and date of birth). The date of birth is a new optional field; the name and date of birth are shown in the workspace header and the patient list.
- Class-data reset also clears the new entries. The one-group-per-patient roster rule and the code seeding go away.

### Out of scope

- Editing a saved entry (delete and re-enter instead).
- Any change to Pflegebericht behaviour beyond which visitors may use it.
- Other patient details (gender, room as its own field, diagnoses) and creating or deleting patients. The roster stays at ten patients; only name and date of birth are editable.
- Seeding invented dates of birth. The new field starts empty and the teacher fills it in.
- Dropping the superseded tables (`vital_daily_records`, `measurement_requirements`, `student_groups`); they stay in place, unused, so the migration is additive and the previous release keeps working until the switch.
- Migrating old daily records into entries. A daily record carries no clock time, and inventing one would fabricate data. The live database holds no class data yet.
- Hovering the chart to inspect points, export, notifications and any new authentication scheme.

### Sequencing

`add-nursing-documentation-simulator` is still an active change (66 of 68 tasks done, so its specs are not in `openspec/specs/` yet). This change modifies and removes requirements defined there, so that change must be archived first; the deltas below use the exact requirement headers from its specs.

## Capabilities

### New Capabilities

- `patient-workspace`: the front page Start button, the three-tab patient workspace (Dashboard, Vitalwerte, Pflegebericht) with Dashboard as the default, and the patient name and date of birth shown in the header and the list.

### Modified Capabilities

- `vitalwerte`: from one daily record per patient to timestamped entries; category tabs, entry form with day and time, explicit save, delete-only corrections, pair saving for blood pressure, simplified validation and audit.
- `vitals-visualization`: from a date-column table with gap warnings to a read-only dashboard with a four-series chart, day and week views, solid lines, per-kind entry rows and hover linking; all missing-value requirements removed.
- `patient-access`: students no longer sign in; every visitor opens any patient; the teacher authenticates with one simple password and cannot write.
- `teacher-console`: add the patient-details editor (name, date of birth) with its audit; remove the expected-measurement editor and its audit; roster has patients only; reset covers the new entries and keeps edited patient details.
- `pflegebericht`: the revision-history scenario no longer assumes a signed-in actor.

## Impact

- **Data**: one new table `vital_entries` and one new nullable column `patients.date_of_birth` (additive migration). Existing daily records, expected-measurement rows and group rows are left untouched and no longer read.
- **API**: `POST/GET /api/patients/{id}/vitals` and `DELETE /api/patients/{id}/vitals/{submissionId}` replace the per-day route and the `requirements` route; `PATCH /api/patients/{id}` (teacher only) edits name and date of birth; the group branch of `/api/auth/login` is removed.
- **UI**: new dashboard, entry form and category tabs; removed table, cell editor, missing-values warning, expected-fields editor and the vital-view state; the date-parts picker and calendar popover are reused.
- **Operations**: the Turso migration must run before the new release is deployed; the teacher password hash is rotated by changing `TEACHER_PASSWORD_HASH`, no code change. No new dependencies.
- **Security posture**: any visitor can add or delete entries and reports for any patient. This is an accepted trade-off for a practice tool holding only invented data; same-origin checks, teacher throttling and the teacher reset remain.
