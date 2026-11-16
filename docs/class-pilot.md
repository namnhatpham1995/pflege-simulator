# Klassenpilot – Checkliste

Vor dem ersten Einsatz mit einer Klasse einmal durchgehen. Alle Personen und Werte sind fiktiv.

## Vorbereitung

- [ ] `npm run db:migrate` und `npm run db:seed` gegen die Zielumgebung ausgeführt.
- [ ] Zehn Codes aus `.local/group-codes.txt` bzw. dem einmaligen stdout gesichert und
      gruppenweise verteilt (nicht im Klassenchat öffentlich posten).
- [ ] Lehrkraft-Login mit `TEACHER_PASSWORD_HASH` getestet.
- [ ] Backup vor dem Pilot gezogen (`turso db shell … .dump`).

## Zehn-Gruppen-Check

- [ ] Alle zehn Gruppen melden sich gleichzeitig an; keine Gruppe erhält `429`.
- [ ] Jede Gruppe sieht **nur** ihren zugewiesenen Patienten (Name im Kopf der Seite).
- [ ] Jede Gruppe speichert einen systolischen Wert und lädt die Seite neu; der Wert bleibt.
- [ ] Jede Gruppe schreibt einen Pflegebericht; er erscheint mit Datum, Uhrzeit und Schicht.

## Zweitgerät-Check

- [ ] Dieselbe Gruppe meldet sich auf einem zweiten Gerät an; die Daten sind identisch.
- [ ] Ein auf Gerät A gespeicherter Wert erscheint nach dem Neuladen auf Gerät B.
- [ ] Ein veralteter Stand auf Gerät B führt zu einem Konfliktbanner statt zu stillem
      Überschreiben.

## Isolationsversuch

- [ ] Mit dem Code von Gruppe 1 die Patienten-URL von Gruppe 2 aufrufen → `404`/„nicht gefunden“.
- [ ] Denselben Versuch per API: `GET /api/patients/<fremde-id>/vitals?from=…&to=…` → `403`.
- [ ] Lehrkraft-Konsole mit einem Gruppencode öffnen → `404`.

## Ende des Semesters

- [ ] Backup gezogen und geprüft (Zählungen in einer Scratch-Datenbank).
- [ ] `npm run db:reset-class-data -- --confirm RESET` ausgeführt.
- [ ] Danach: zehn Patienten und zehn Gruppen vorhanden, Vitalwerte und Berichte leer.
- [ ] Codes bleiben gültig; neue Gruppen brauchen keinen neuen Seed.

## Lokal verifiziert

Mit `file:./.local/e2e.db` (frisch geseedet) geprüft: Anmeldung, Patientenzuordnung,
Speichern und Neuladen, Konflikt-`409`, Reset-Zählungen. Nicht geprüft: echte Zehn-Gruppen-
Last, echtes Zweitgerät, Turso-Backup/Restore (Aufgaben 8.8/8.9 sind blockiert).
