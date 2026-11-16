# Pflegebericht

Ein Pflegebericht besteht aus Datum, Uhrzeit, Schicht (`frueh`, `spaet`, `nacht`) und einem
freien Text. Mehrere Berichte pro Patient, Tag und Schicht sind ausdrücklich erlaubt.

## Zeitmodell

`observed_date` (`YYYY-MM-DD`) und `observed_time` (`HH:MM`) werden getrennt als
**Berliner Wandzeit** gespeichert und nie in UTC umgerechnet. Eine lokale Uhrzeit ist zweimal
im Jahr mehrdeutig bzw. nicht existent; die Schichtübergabe meint aber genau „14:30 am 25.10.“.
Sortiert wird lexikografisch über beide Spalten, was für dieses Format chronologisch korrekt
ist und keine Zeitzonenumrechnung braucht.

`Vitalwerte` speichert dagegen nur Datum und Uhrzeit je Messwert, ohne Schicht und ohne
Tagesdatensatz.

## Anlegen

```http
POST /api/patients/{patientId}/reports
Origin: http://localhost:3000
Content-Type: application/json

{ "observedDate": "2026-11-16", "observedTime": "14:30", "shift": "spaet", "body": "…" }
```

Antwort `201 { report }`. Der Text wird getrimmt und muss 1–10.000 Zeichen lang sein; ein
unbekannter Schichtwert oder ein ungültiges Datum ist `400 VALIDATION`. Jeder Besucher ohne
Lehrkraft-Sitzung darf schreiben; die Lehrkraft erhält `403`.

## Lesen

```http
GET /api/patients/{patientId}/reports?limit=20&before=2026-11-16|14:30|<id>
```

`limit` ist auf 50 begrenzt, Standard 20. `before` ist der Cursor des letzten Eintrags der
vorherigen Seite; sortiert wird absteigend nach Datum, Uhrzeit und ID. Die Antwort enthält
keine berechnete Gesamtzahl, nur `{ reports }`.

## Bearbeiten und Verlauf

```http
PATCH /api/patients/{patientId}/reports/{reportId}
{ "version": 1, "body": "korrigierter Text" }
```

Nur der Text ist änderbar; Datum, Uhrzeit und Schicht bleiben, damit der dokumentierte
Zeitpunkt nicht rückwirkend verschoben wird.

- Stimmt `version` nicht, antwortet die Route `409` mit `current` (der aktuellen Fassung).
- Jede akzeptierte Änderung erhöht `version` und schreibt **den vorherigen** Text als
  unveränderliche Zeile in `care_report_revisions` (`UNIQUE(report_id, version)`).
- `GET /api/patients/{patientId}/reports/{reportId}/revisions` liefert alle früheren Fassungen
  aufsteigend. Es gibt keinen Lösch- und keinen Überschreibpfad für Revisionen; die Oberfläche
  zeigt sie ausschließlich lesbar.
- Auch die Änderung selbst landet im `audit_log`.

## Schichten

| Wert | Anzeige | Bedeutung |
|---|---|---|
| `frueh` | Früh | Frühdienst |
| `spaet` | Spät | Spätdienst |
| `nacht` | Nacht | Nachtdienst |

Die Schicht ist ein Merkmal des Berichts, keine Eigenschaft des Tages: derselbe Tag kann
mehrere Berichte aus derselben oder aus verschiedenen Schichten tragen.
