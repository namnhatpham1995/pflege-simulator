# Vitalwerte – API

Ein Datensatz pro Patient und Kalendertag, acht nullbare Zahlenfelder, keine Schicht.
Alle Routen prüfen die Sitzung und die Patientenzuordnung über `requirePatientAccess`.

## Felder und Grenzen

| Feld | Einheit | Typ | Bereich |
|---|---|---|---|
| `systolic` | mmHg | Ganzzahl | 50–300 |
| `diastolic` | mmHg | Ganzzahl | 30–200 |
| `pulse` | Schläge/min | Ganzzahl | 20–250 |
| `temperature` | °C | Dezimal | 30–45 |
| `weight` | kg | Dezimal | 0,5–400 |
| `height` | cm | Dezimal | 30–250 |
| `pain` | 0–10 | Ganzzahl | 0–10 |
| `glucose` | mg/dL | Ganzzahl | 10–900 |

Zusätzlich gilt: Sind beide Blutdruckwerte gesetzt, muss `diastolic < systolic` sein. Die
Prüfung läuft auf dem **zusammengeführten** Datensatz, nicht auf dem Patch.

## Bereiche lesen

```http
GET /api/patients/{patientId}/vitals?from=2026-11-10&to=2026-11-23
```

```json
{
  "records": [
    {
      "id": "c1f0…",
      "patientId": "…",
      "date": "2026-11-10",
      "systolicMmhg": 120,
      "diastolicMmhg": 80,
      "pulseBpm": 72,
      "temperatureC": null,
      "weightKg": null,
      "heightCm": null,
      "painScore": 0,
      "glucoseMgDl": null,
      "version": 1,
      "createdAt": "2026-11-10T08:00:00.000Z",
      "updatedAt": "2026-11-10T08:00:00.000Z"
    }
  ],
  "requirements": { "systolic": true, "diastolic": true, "pulse": true, "temperature": false,
                    "weight": false, "height": false, "pain": false, "glucose": false }
}
```

Der Zeitraum umfasst höchstens 31 Tage; `from` nach `to` und ungültige Daten sind `400`.

## Einen Tag lesen

```http
GET /api/patients/{patientId}/vitals/2026-11-10
```

```json
{ "record": null, "version": 0 }
```

Ein leerer Tag erzeugt **keinen** Datensatz; `version: 0` ist die Einladung, ihn anzulegen.

## Speichern

```http
PATCH /api/patients/{patientId}/vitals/2026-11-10
Origin: http://localhost:3000
Content-Type: application/json

{ "version": 0, "values": { "systolic": 120, "diastolic": 80, "pulse": "72", "temperature": "36,8" } }
```

Antwort `200`:

```json
{ "record": { "…": "…", "version": 1 }, "version": 1 }
```

Regeln:

- `version: 0` legt den Tag an. Existiert er bereits, antwortet die Route `409`.
- `version` muss der zuletzt gelesenen Version entsprechen, sonst `409` mit `current`.
- Weggelassene Felder bleiben unverändert, `null` löscht einen Wert.
- `""` wird wie `null` behandelt, Komma-Dezimalen (`"36,8"`) werden akzeptiert.
- Unbekannte Schlüssel – etwa `shift` – sind `400 VALIDATION`.
- `pain: 0` ist ein gültiger Wert und wird nicht als fehlend behandelt.

### Konflikt

```json
{
  "error": { "code": "CONFLICT", "message": "Der Tag wurde zwischenzeitlich geändert." },
  "current": { "record": { "…": "…", "version": 3 }, "version": 3 }
}
```

Die Oberfläche zeigt daraus den aktuellen Stand und bietet an, die eigenen Werte darauf
anzuwenden; nichts wird still überschrieben.

## Fehler

| Status | Code | Ursache |
|---|---|---|
| 400 | `VALIDATION` | ungültiges Datum, ungültiger Körper, Bereichsverstoß, `diastolic >= systolic` |
| 401 | `UNAUTHENTICATED` | keine Sitzung |
| 403 | `FORBIDDEN` | fremder Patient oder Lehrkraft beim Schreiben |
| 403 | `ORIGIN` | fehlender/fremder `Origin` bei `PATCH` |
| 409 | `CONFLICT` | veraltete Version oder bereits vorhandener Tag |
