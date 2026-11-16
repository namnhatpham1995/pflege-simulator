# Betriebs-Runbook

Zielgruppe: die Lehrkraft oder eine technische Begleitung, die die Simulation für ein Semester
aufsetzt. Alle Kommandos laufen von einem kontrollierten Rechner aus, nie aus dem Browser.

## 1. Turso-Datenbank anlegen

```bash
turso db create pflege-simulator
turso db show pflege-simulator --url
turso db tokens create pflege-simulator
```

Die URL (`libsql://…`) und das Token werden **nur** als Umgebungsvariablen hinterlegt, nie im
Repository. Lokal gehören sie in `.env.local` (gitignoriert):

```bash
TURSO_DATABASE_URL=libsql://…
TURSO_AUTH_TOKEN=…
DATABASE_URL=file:./.local/dev.db        # nur lokal, wird von Turso überschrieben
```

`src/db/client.ts` bevorzugt `TURSO_DATABASE_URL`; ist sie gesetzt, geht jeder Zugriff dorthin.

## 2. Migration und Seed

```bash
npm ci
npm run db:migrate
npm run db:seed
```

- `db:migrate` führt `scripts/migrate.ts` aus und damit denselben `runMigrations`-Pfad wie die
  Anwendung. Grund: `drizzle-kit migrate` beendet sich gegen Turso mit Exit-Code 1 ohne
  Meldung; der Fehler ließ sich ohne Turso-Zugangsdaten hier nicht reproduzieren. Gegen eine
  frische lokale libSQL-Datei läuft `npm run db:migrate` erfolgreich durch (verifiziert).
- Migration `0000` legt das Grundschema an; Migration `0001` ergänzt **additiv**
  `vital_entries` und `patients.date_of_birth`. Die alten Tabellen bleiben bestehen.
- `db:seed` legt zehn fiktive Patienten mit stabilen IDs und ohne Geburtsdatum an. Es ist
  idempotent und überschreibt keine von der Lehrkraft geänderten Details. Gruppen und
  Zugangscodes werden nicht mehr erzeugt.
- Ein Turso-Lauf von `0001` ist Teil der Release-Aufgaben und hier **nicht** ausgeführt.

## 3. Vercel

Umgebungsvariablen im Projekt (Production und Preview getrennt prüfen):

| Variable | Pflicht | Zweck |
|---|---|---|
| `TURSO_DATABASE_URL` | ja | libSQL-URL der Produktionsdatenbank |
| `TURSO_AUTH_TOKEN` | ja | Token für genau diese Datenbank |
| `SESSION_SECRET` | ja | Pepper für Session-Hashes, mindestens 32 Zeichen |
| `TEACHER_PASSWORD` | ja | Lehrkraft-Passwort im Klartext |
| `TEACHER_DISPLAY_NAME` | nein | Anzeigename, Standard „Lehrkraft“ |

Ablauf: Branch nach `main` mergen → Vercel baut → `npm run db:migrate` **vor** dem ersten
Login gegen die Produktionsdatenbank ausführen → bei Bedarf `npm run db:seed` einmalig.
Studierende brauchen keine Codes; die Lehrkraft meldet sich mit ihrem Passwort an.

## 4. Backup

```bash
turso db shell pflege-simulator .dump > backup-$(date +%Y-%m-%d).sql
```

Die Datei enthält alle Tabellen inklusive der Passwort-Hashes und ist damit vertraulich.
Aufbewahrung: ein Backup pro Semesterende und vor jedem `db:migrate` gegen Produktion.

## 5. Restore in eine Scratch-Datenbank

```bash
turso db create pflege-restore
turso db shell pflege-restore < backup-2026-11-16.sql
turso db shell pflege-restore "SELECT COUNT(*) FROM patients;"      # 10
turso db shell pflege-restore "SELECT COUNT(*) FROM vital_entries;" # Einträge prüfen
```

Erst wenn die Zählungen stimmen, die Anwendung auf die Scratch-URL zeigen lassen
(`TURSO_DATABASE_URL` in einer Preview-Umgebung) und dort einen Patienten öffnen. Niemals
direkt in die Produktionsdatenbank zurückspielen, ohne vorher ein aktuelles Backup zu ziehen.

## 6. Rollback

1. Vercel → Deployments → vorheriges Deployment „Promote to Production“.
2. Die vorherige Version ignoriert `vital_entries` und `patients.date_of_birth`; beide bleiben
   erhalten. Neue Messwerte aus der neuen Version bleiben in `vital_entries` liegen.
3. Bei Datenproblemen: Scratch-Restore prüfen, dann Produktion aus dem Backup neu aufbauen.
4. `db:migrate` ist additiv; ein Rollback der Anwendung ohne Schema-Rollback ist der
   Normalfall.

## 7. Semesterwechsel

```bash
npm run db:reset-class-data -- --confirm RESET
```

Löscht Messwerte, Pflegeberichte, Fassungen und Auditzeilen (einschließlich der alten
Tagesdatensätze). Patienten mit ihren Namen und Geburtsdaten bleiben. Alternativ die
Lehrkraft-Konsole verwenden; beide Wege rufen denselben Service auf.

## 8. Patientendetails

Die Lehrkraft ändert Name und Geburtsdatum im Patientenbereich (Dialog
„Patientendaten bearbeiten“) oder per `PATCH /api/patients/{id}`. Eine Änderung wird auditiert
und vom Seed nicht überschrieben. Es gibt keinen Erwartungs-Editor mehr.

## Status der Rehearsals

- Lokal verifiziert: Migrationen `0000` und `0001`, Seed, `db:reset-class-data` gegen lokale
  libSQL-Dateien.
- **Produktion, 2026-11-16:** Das Turso-CLI war nicht installiert; das Backup entstand daher
  als JSON-Export aller Tabellen über `@libsql/client` (`.local/backups/`, gitignoriert,
  vertraulich) statt als `.dump`. Vorher: 10 Patienten, 2 Tagesdatensätze, 1 Pflegebericht,
  16 Auditzeilen. `npm run db:migrate` gegen Turso lief ohne Fehler; danach existieren
  `vital_entries` mit beiden Indizes und `patients.date_of_birth`, alle Zählungen unverändert.
  Die vorherige Produktionsversion lieferte danach weiter `/login` (200).
- **Produktions-Smoke** (`https://pflege-simulator.vercel.app`, Deployment
  `pflege-simulator-jz0xcz6q4`): Start, `/login` und Patientenliste anonym 200; alle sieben
  Kategorien gespeichert (201, Blutdruck als Paar); Tages- und Wochenabfrage lieferten je acht
  Zeilen; Dashboard (Tag, Woche) und Vitalwerte 200; fremde Origin 403; anonymer Lehrkraft-Aufruf
  401; Löschen aller Smoke-Einträge 200, danach leer, zweites Löschen 404. Die Smoke-Einträge
  sind gelöscht; Auditzeilen bleiben bestehen.
- **Lehrkraft auf Produktion (2026-11-16, nach Umstellung auf `TEACHER_PASSWORD`):** falsches
  Passwort 401, richtiges Passwort 200, `/teacher` mit Sitzung 200; Geburtsdatum per
  `PATCH /api/patients/{id}` gesetzt (200) und wieder geleert; die Vitalwerte-Seite der Lehrkraft
  enthält kein Eingabefeld und keinen Speichern-Button, die der Studierenden sechs Eingabefelder.
  Ein Umbenennen mit neuem Namen wurde nicht ausgeführt (Name unverändert zurückgesendet), die
  Browser-Oberfläche des Dialogs wurde auf Produktion nicht bedient.
- **Nicht geprüft:** Backup-Restore in eine Scratch-Datenbank.
- **Rollback-Probe (eingeschränkt):** Die vorherige Version (`pflege-simulator-575ydotmp`)
  wurde direkt angefragt statt promoted: `/login` 200 und `/api/patients` 401 gegen die
  migrierte Datenbank. Ein echtes Promote wurde nicht ausgeführt, um die Produktion nicht zu
  unterbrechen.
