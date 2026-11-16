# Klassenpilot – Checkliste

Vor dem ersten Einsatz mit einer Klasse einmal durchgehen. Alle Personen und Werte sind fiktiv,
und der Zugang ist absichtlich offen.

## Vorbereitung

- [ ] `npm run db:migrate` und `npm run db:seed` gegen die Zielumgebung ausgeführt.
- [ ] Lehrkraft-Login mit `TEACHER_PASSWORD` getestet.
- [ ] `Start` auf der Frontseite getestet: Patientinnenliste ohne Anmeldung erreichbar.
- [ ] Backup vor dem Pilot gezogen (`turso db shell … .dump`), falls schon Klassendaten
      existieren.

## Zehn-Patienten-Check

- [ ] Alle zehn Patientinnen und Patienten erscheinen in der Liste, jeweils mit Name und
      Geburtsdatum oder „Geburtsdatum nicht angegeben“.
- [ ] Ein Klick öffnet das Dashboard; die drei Tabs stehen in der Reihenfolge Dashboard,
      Vitalwerte, Pflegebericht.
- [ ] Jede Kategorie lässt sich speichern: Blutdruck (zwei Werte), Puls, Temperatur, Gewicht,
      Größe, Schmerzen, Blutzucker.
- [ ] Ein Blutdruck-Paar erscheint als **eine** Zeile in „Letzte Einträge“ und als zwei
      Punkte im Diagramm.
- [ ] Zwei Speicherungen zur selben Minute erzeugen zwei Einträge; keiner überschreibt den
      anderen.
- [ ] Im Dashboard zeigt `Tag` den gewählten Tag, `Woche` Montag bis Sonntag; Zurück/Weiter
      verschiebt um einen Tag bzw. eine Woche.
- [ ] Hover oder Tastaturfokus auf ein Wertkästchen zeigt `TT.MM.JJJJ HH:MM`; bei Puls,
      Temperatur und Blutdruck leuchtet der passende Diagrammpunkt.
- [ ] Löschen fragt nach, entfernt ein Blutdruck-Paar vollständig und ist danach auditiert.

## Zweitgerät-Check

- [ ] Zwei Geräte öffnen denselben Patienten; ein auf Gerät A gespeicherter Wert erscheint
      nach dem Neuladen auf Gerät B.
- [ ] Ein Löschen auf Gerät A verschwindet auf Gerät B nach dem Neuladen aus der Liste und
      dem Dashboard.

## Offener Zugang – bewusster Test

- [ ] Ein beliebiger Besucher kann einen anderen Patienten öffnen: das ist gewollt.
- [ ] Die Lehrkraft sieht in Vitalwerte und Pflegebericht **kein** Eingabeformular und keinen
      Löschknopf.
- [ ] Ein Schreibversuch mit Lehrkraft-Sitzung über die API endet mit `403`.
- [ ] Ein fremder `Origin` endet mit `403 ORIGIN`.
- [ ] Ohne Lehrkraft-Sitzung antwortet `/teacher` mit der Anmeldeseite und die Lehrkraft-API
      mit `401`.

## Ende des Semesters

- [ ] Backup gezogen und geprüft (Zählungen in einer Scratch-Datenbank).
- [ ] `npm run db:reset-class-data -- --confirm RESET` ausgeführt.
- [ ] Danach: zehn Patienten mit ihren Namen und Geburtsdaten vorhanden, Messwerte und
      Berichte leer.
- [ ] Keine Zugangscodes mehr nötig; die Lehrkraft meldet sich mit ihrem Passwort an.

## Lokal verifiziert

Mit `file:./.local/e2e.db` (frisch geseedet) geprüft: Start, Patient öffnen, alle sieben
Kategorien speichern, Dashboard Tag/Woche, Hover-Verknüpfung, Löschen, Lehrkraft-Ansicht ohne
Eingabefelder. Nicht geprüft: echte Zehn-Gruppen-Last, echtes Zweitgerät, Turso-Backup/Restore.
