# Lehrkraft-Konsole

Die Lehrkraft meldet sich mit ihrem eigenen Passwort an und sieht alle zehn fiktiven
Patienten. Sie hat **lesenden** Zugriff auf Vitalwerte und Pflegeberichte; kein Endpunkt
erlaubt ihr das Anlegen oder Ändern von Einträgen (`403 FORBIDDEN`).

## Erwartete Messwerte

Pro Patient legt die Lehrkraft fest, welche der acht Felder „erwartet“ sind:

- Standard nach dem Seed: `systolic`, `diastolic`, `pulse`.
- `temperature`, `weight`, `height`, `pain`, `glucose` sind optional.
- Ein erwartetes, aber leeres Feld wird rot markiert und im Hinweis unter dem Diagramm
  genannt. Ein optionales leeres Feld erzeugt **keine** Warnung.
- Die Änderung gilt nur für den gewählten Patienten und wird im `audit_log` festgehalten.

```http
PATCH /api/patients/{patientId}/requirements
Origin: http://localhost:3000
{ "field": "temperature", "expected": true }
```

Antwort `200 { requirements }` – immer die vollständige, gespeicherte Policy. Die Oberfläche
zeigt deshalb den Serverstand und keinen optimistischen Zwischenzustand.

## Klassendaten zurücksetzen

Zum Semesterende:

```http
POST /api/admin/reset-class-data
Origin: http://localhost:3000
{ "confirm": "RESET" }
```

oder auf einem kontrollierten Rechner:

```bash
npm run db:reset-class-data -- --confirm RESET
```

Beides ruft denselben Service auf. In einer Transaktion werden `care_report_revisions`,
`care_reports`, `vital_daily_records` und `audit_log` geleert. **Erhalten bleiben**
Patienten, Gruppen, Zugangscode-Hashes und die Measurement-Policy – die Codes des Semesters
funktionieren also weiter.

## Grenzen

- Keine Noten, keine Auswertungen, keine Benachrichtigungen.
- Kein Bearbeiten oder Löschen einzelner Schülereinträge.
- Ein zweiter Lehrkraft-Account ist nicht vorgesehen; die Anmeldung erfolgt über
  `TEACHER_PASSWORD_HASH` aus der Server-Umgebung.
