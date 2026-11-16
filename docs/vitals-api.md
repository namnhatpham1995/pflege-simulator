# Vitalwerte – API

Jeder Messwert ist ein eigener Eintrag mit Art, Wert, Datum und Uhrzeit. Beliebig viele
Einträge derselben Art am selben Tag – auch zur selben Minute – sind erlaubt. Es gibt keine
Version und keinen Konfliktpfad: Speichern legt an, Löschen entfernt.

Alle Routen prüfen über `requirePatientAccess`, dass der Patient existiert. Lesen und
Schreiben sind ohne Anmeldung möglich; die Lehrkraft darf nur lesen.

## Arten und Grenzen

| Art | Einheit | Typ | Bereich |
|---|---|---|---|
| `systolic` | mmHg | Ganzzahl | 50–300 |
| `diastolic` | mmHg | Ganzzahl | 30–200 |
| `pulse` | Schläge/min | Ganzzahl | 20–250 |
| `temperature` | °C | Dezimal | 30–45 |
| `weight` | kg | Dezimal | 0,5–400 |
| `height` | cm | Dezimal | 30–250 |
| `pain` | 0–10 | Ganzzahl | 0–10 |
| `glucose` | mg/dL | Ganzzahl | 10–900 |

Kategorien der Oberfläche: `blutdruck` (systolic + diastolic), `puls`, `temperatur`,
`gewicht`, `groesse`, `schmerzen`, `blutzucker`. Ein Blutdruck-Speichern enthält beide Werte
und wird atomar geschrieben; `diastolic < systolic` gilt nur innerhalb dieses einen Paares.
Einträge zu verschiedenen Zeiten werden nie miteinander verglichen.

## Bereiche lesen

```http
GET /api/patients/{patientId}/vitals?from=2026-11-01&to=2026-11-14
```

```json
{
  "entries": [
    {
      "id": "c1f0…",
      "patientId": "…",
      "kind": "pulse",
      "value": 72,
      "observedDate": "2026-11-12",
      "observedTime": "09:15",
      "submissionId": "0b7e…",
      "createdAt": "2026-11-12T08:15:00.000Z"
    }
  ]
}
```

Der Zeitraum ist inklusiv und auf 31 Tage begrenzt. Sortiert wird nach Datum, Uhrzeit und
Erstellzeit; gleiche Zeiten behalten ihre Erstellreihenfolge. `from` nach `to`, ein ungültiges
Datum oder ein zu langer Zeitraum sind `400 VALIDATION`. Ein Tag ohne Einträge liefert
`{ "entries": [] }` – keine Nullzeile.

## Speichern

```http
POST /api/patients/{patientId}/vitals
Origin: http://localhost:3000
Content-Type: application/json

{
  "category": "blutdruck",
  "values": { "systolic": "120", "diastolic": "80" },
  "date": "2026-11-12",
  "time": "08:00"
}
```

Antwort `201`:

```json
{
  "entries": [ { "kind": "systolic", "value": 120, "…": "…" },
               { "kind": "diastolic", "value": 80, "…": "…" } ],
  "groups": [ { "submissionId": "…", "category": "blutdruck",
                "observedDate": "2026-11-12", "observedTime": "08:00",
                "values": { "systolic": 120, "diastolic": 80 }, "createdAt": "…" } ]
}
```

Regeln:

- `values` ist strikt: nur die Felder der gewählten Kategorie, alle mit Wert.
- `"36,8"` wird als Dezimalzahl gelesen; `""` ist ein fehlender Wert und wird abgelehnt.
- Unbekannte Schlüssel – etwa `shift` – sind `400 VALIDATION`; ebenso `24:00`, `12:60` und
  unmögliche Kalenderdaten wie `2027-02-29`.
- `pain: 0` ist ein gültiger Eintrag und kein leerer Platzhalter.
- Bei einer ungültigen Blutdruck-Hälfte wird keine der beiden Zeilen geschrieben.
- `date` und `time` werden unverändert als Wandzeit gespeichert; eine durch die Zeitumstellung
  übersprungene Uhrzeit wie `02:30` am 27.03.2027 bleibt gültig.

## Löschen

```http
DELETE /api/patients/{patientId}/vitals/{submissionId}
Origin: http://localhost:3000
```

Ein Blutdruck-Paar wird als Einheit gelöscht. Antwort `200 { "deleted": 2 }`; ein bereits
gelöschter Eintrag ist `404 NOT_FOUND`. Die Lehrkraft erhält `403 FORBIDDEN`.

## Audit

Jedes akzeptierte Speichern und Löschen schreibt genau eine `audit_log`-Zeile mit Akteur,
Patient, Aktion, Art, Wert, Datum und Uhrzeit. Der anonyme Akteur erscheint als
`actor_type = 'group'`, `actor_id = 'patient:<patientId>'`. Lesen schreibt nichts.

## Fehler

| Status | Code | Ursache |
|---|---|---|
| 400 | `VALIDATION` | ungültiges Datum/Zeit, ungültiger Körper, Bereichsverstoß, Paarregel |
| 401 | — | nur Lehrkraft-Routen; die Messwert-Routen sind offen |
| 403 | `FORBIDDEN` | Lehrkraft beim Schreiben oder Löschen |
| 403 | `ORIGIN` | fehlender/fremder `Origin` bei `POST`/`DELETE` |
| 404 | `NOT_FOUND` | unbekannter Patient oder bereits gelöschter Eintrag |
