# Parallele Umsetzung

Dieses Dokument hält den Arbeitsvertrag für die Gruppen aus
`openspec/changes/add-nursing-documentation-simulator/tasks.md` fest.

## Paketmanager

Auf dem Entwicklungsrechner ist **npm** installiert, nicht pnpm. Alle Befehle lauten
daher `npm run <script>`; die Skriptnamen entsprechen dem Design (`verify`, `db:migrate`,
`db:seed`, `test`, `test:e2e`, `worktree`).

## Eingefrorene Foundation-Dateien

Diese Dateien gehören Gruppe 1. Andere Gruppen lesen sie nur. Wer eine Änderung braucht,
meldet `BLOCKED` mit dem genauen Bedarf, statt die Datei zu bearbeiten.

```
package.json  package-lock.json  tsconfig.json  next.config.ts  postcss.config.mjs  tailwind.config.ts
.env.example  drizzle.config.ts  drizzle/**  scripts/**  docs/parallel-work.md
src/app/layout.tsx  src/app/globals.css  src/app/page.tsx
src/db/schema.ts  src/db/client.ts  src/db/migrate.ts  src/db/seed.ts
src/lib/types.ts  src/lib/date.ts  src/lib/api-error.ts  src/lib/env.ts  src/lib/cn.ts
src/components/ui/**
src/server/auth/password.ts  src/server/auth/session.ts  src/server/services/access.ts
tests/setup.ts  tests/helpers/database.ts  vitest.config.ts  playwright.config.ts
```

Ausnahme: `scripts/reset-class-data.ts` gehört Gruppe 6 (Lehrkraft-Konsole), weil das
Skript denselben Service wie die Route aufrufen muss.

## Gruppen und Dateieigentum

| Gruppe | Branch | Schreibt | Darf lesen | Hängt ab von |
|---|---|---|---|---|
| 1 Foundation | `feat/foundation` | siehe Liste oben | Quellplan | — |
| 2 Zugang & Shell | `feat/access-shell` | `src/app/(auth)/**`, `src/app/api/auth/**`, `src/app/api/patients/route.ts`, `src/server/auth/login.ts`, `src/server/auth/rate-limit.ts`, `src/server/services/patients.ts`, `src/components/login-form.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/patients/**/layout.tsx`, `src/components/section-tabs.tsx`, `docs/access.md` | Foundation | 1 |
| 3 Vitalwerte-Daten | `feat/vitals-data` | `src/app/api/patients/[patientId]/vitals/**`, `src/server/services/vitals.ts`, `src/lib/validation/vitals.ts`, `src/lib/vitals.ts`, `docs/vitals-api.md` | Foundation | 1 |
| 4 Datumsauswahl | `feat/date-picker` | `src/components/date-parts-picker.tsx`, `src/components/calendar-popover.tsx`, Tests dazu | `src/lib/date.ts` | 1 |
| 5 Visualisierung | `feat/vitals-visualisation` | `src/components/vital-chart.tsx`, `src/components/vitals-table.tsx`, `src/components/vital-cell-editor.tsx`, `src/components/missing-values-warning.tsx`, `src/lib/chart-segments.ts`, `src/lib/missing-value-policy.ts`, `src/state/vital-view.tsx`, Tests dazu | Foundation, Specs | 1 |
| 6 Pflegebericht | `feat/pflegebericht` | `src/app/api/patients/[patientId]/reports/**`, `src/server/services/reports.ts`, `src/lib/validation/reports.ts`, `src/app/(app)/patients/[patientId]/pflegebericht/page.tsx`, `src/components/care-report-*.tsx`, `docs/pflegebericht.md` | Foundation | 1 |
| 7 Lehrkraft-Konsole | `feat/teacher-console` | `src/app/(app)/teacher/**`, `src/app/api/patients/[patientId]/requirements/route.ts`, `src/app/api/admin/reset-class-data/route.ts`, `src/server/services/requirements.ts`, `src/server/services/reset.ts`, `src/components/expected-fields-editor.tsx`, `scripts/reset-class-data.ts`, `docs/teacher.md` | Foundation, Zugang | 1, 2 |
| 8 Integration & Release | `feat/vitalwerte-integration` | `src/app/(app)/patients/[patientId]/vitalwerte/**`, `src/app/(app)/patients/[patientId]/page.tsx`, `tests/e2e/**`, `docs/runbook.md`, `docs/class-pilot.md` | alles | 2–7 |

## Wellen

```
W0  Gruppe 1                    seriell, blockiert alles
W1  Gruppe 2 3 4 5 6            fünf disjunkte Gruppen
W2  Gruppe 7 8                  nach 2 bzw. nach 2–6
```

## Merge-Reihenfolge

1. Gruppe 1, danach die W1-Gruppen in beliebiger Reihenfolge, danach 7 und 8.
2. Jede Gruppe rebased vor dem Merge auf den aktuellen Stand.
3. Nur die Foundation ändert `package.json` und die Lockfile. Eine benötigte
   Abhängigkeit wird als `chore/deps-<name>` separat eingespielt.
4. Nur die Foundation erzeugt Migrationen.
5. Erzeugte Artefakte (`drizzle/meta/**`, `playwright-report/`, `.next`) werden nicht committet.
6. Tailwind-Klassen sind der Styling-Vertrag; `globals.css` und `tailwind.config.ts` bleiben unverändert.

## Abschlussbericht je Gruppe

```
Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
Summary: zwei Sätze
Files: berührte Pfade
Tests: ausgeführte Befehle mit Exit-Status
```

## Lokale Umgebung

```
npm install
npm run db:migrate      # lokale Datei .local/dev.db
npm run db:seed         # zehn Patienten, zehn Gruppen, Zugangscodes
npm run dev
```

Zugangscodes stehen einmalig in `.local/group-codes.txt` (gitignoriert).
