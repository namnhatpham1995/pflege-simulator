# Lehrkraft-Konsole

Die Lehrkraft meldet sich mit ihrem Passwort an und sieht alle zehn fiktiven Patienten. Sie
hat **lesenden** Zugriff auf Dashboard, Messwerte und Pflegeberichte; kein Endpunkt erlaubt
ihr das Anlegen, Ändern oder Löschen von Einträgen (`403 FORBIDDEN`).

## Patientendaten bearbeiten

Im Patientenbereich (Kopfzeile) öffnet die Lehrkraft **Patientendaten bearbeiten**:

- **Name**: 1–100 Zeichen nach dem Trimmen; ein leerer Name wird mit einem Feldfehler
  abgelehnt.
- **Geburtsdatum**: optional. Gültiges Kalenderdatum, nicht vor dem 01.01.1900 und nicht in
  der Zukunft. Über **Geburtsdatum löschen** wird der Wert auf `null` gesetzt.
- Jede akzeptierte Änderung erhält eine Audit-Zeile mit Lehrkraft, Patient, Feld sowie altem
  und neuem Wert.

```http
PATCH /api/patients/{patientId}
Origin: http://localhost:3000
Content-Type: application/json

{ "displayName": "Herr Berger", "dateOfBirth": "1948-03-07" }
```

```json
{ "patient": { "id": "…", "displayName": "Herr Berger", "dateOfBirth": "1948-03-07" } }
```

Ohne Lehrkraft-Sitzung antwortet die Route `401`, mit einem fremden `Origin` `403`.
Der Seed überschreibt bearbeitete Namen und Geburtsdaten nicht.

## Erwartete Messwerte

Der frühere Erwartungs-Editor ist entfernt. Es gibt keine roten Zellen, kein `Fehlt` und
keine Warnung über fehlende Werte: Eine freie, zeitgestempelte Dokumentation vergleicht nicht
mehr gegen eine Tagescheckliste. Die Tabelle `measurement_requirements` bleibt unbenutzt in
der Datenbank, bis ein späterer Change sie entfernt.

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
`care_reports`, `vital_entries` und `audit_log` geleert; zusätzlich werden die alten
`vital_daily_records` aus der früheren Version geräumt. **Erhalten bleiben** Patienten mit
ihren aktuellen Namen und Geburtsdaten. Ohne die exakte Bestätigung `RESET` wird nichts
gelöscht (`400`), ohne Lehrkraft-Sitzung antwortet die Route `401`.

## Grenzen

- Keine Noten, keine Auswertungen, keine Benachrichtigungen.
- Kein Bearbeiten oder Löschen einzelner Schülereinträge.
- Ein zweiter Lehrkraft-Account ist nicht vorgesehen; die Anmeldung erfolgt über
  `TEACHER_PASSWORD_HASH` aus der Server-Umgebung.
