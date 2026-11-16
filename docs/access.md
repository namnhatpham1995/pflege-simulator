# Zugang und Sitzungen

## Anmeldung

Zwei getrennte Anmeldearten, beide über `POST /api/auth/login`:

| Art | Eingabe | Prüfung |
|---|---|---|
| Lerngruppe | Zugangscode (32 Zeichen, Base32) | scrypt-Vergleich gegen `student_groups.access_code_hash` |
| Lehrkraft | Passwort | scrypt-Vergleich gegen `TEACHER_PASSWORD_HASH` aus der Server-Umgebung |

Fehlermeldungen sind absichtlich generisch („Zugangscode oder Passwort ist falsch.“); die
Antwort verrät nicht, ob ein Code existiert oder eine Gruppe inaktiv ist.

Zugangscodes werden nie im Klartext gespeichert. Sie entstehen einmalig beim Seed
(`npm run db:seed`), stehen danach in `.local/group-codes.txt` und lassen sich nur über

```bash
npm run db:seed -- --rotate "Gruppe 3"
```

neu setzen. Das ist der einzige Wiederherstellungsweg.

## Lehrkraft-Passwort setzen

```bash
npm run hash-password -- "mein Passwort"   # gibt einen scrypt-Hash aus
npm run hash-password -- --write           # erzeugt Passwort + SESSION_SECRET und schreibt .env.local
```

`--write` legt das Klartext-Passwort einmalig in `.local/teacher-credentials.txt` ab; danach
existiert nur noch der Hash. `TEACHER_PASSWORD_HASH` gehört ausschließlich in die
Server-Umgebung (lokal `.env.local`, produktiv Vercel-Projektvariablen), nie in eine
`NEXT_PUBLIC_`-Variable.

## Sitzungen

- Cookie `pflege_session`, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in Produktion.
- Der Token ist 32 zufällige Bytes (base64url). In der Datenbank steht nur ein mit
  `SESSION_SECRET` gepfefferter SHA-256-Hash.
- Leerlauf-Timeout 8 Stunden, absolute Lebensdauer 7 Tage. `last_seen_at` wird höchstens
  alle 5 Minuten fortgeschrieben.
- Eine Anmeldung löscht eine bereits vorhandene Sitzung aus dem vorgelegten Cookie
  (Session-Fixation) und stellt eine neue aus.
- Abmelden (`POST /api/auth/logout`) löscht die Sitzungszeile und setzt das Cookie auf
  `maxAge: 0`. Ohne Sitzung antwortet die Route mit 401.

## Drosselung

`login_attempts` speichert feste Fenster pro Schlüssel:

| Schlüssel | Grenze | Zweck |
|---|---|---|
| `code:<sha256(code)>` | 5 Fehlversuche / 5 Minuten | Eine Gruppe darf die Klasse nicht aussperren |
| `ip:<sha256(adresse)>` | 60 Fehlversuche / 10 Minuten | Schutz gegen Durchprobieren vieler Codes |

Der fünfte Fehlversuch im Fenster antwortet mit `429` und `Retry-After`. Eine erfolgreiche
Anmeldung löscht die Fenster des Code-Schlüssels; andere Gruppen bleiben unberührt.

## Autorisierung

`requirePatientAccess(patientId)` ist der einzige Prüfpfad für Server-Komponenten und
Route-Handler. Eine Gruppe erhält ausschließlich ihren zugeordneten Patienten (sonst 403,
unbekannte IDs 404), die Lehrkraft alle zehn. Jede schreibende Route ruft zusätzlich
`assertSameOrigin(request)` auf: fehlt der `Origin`-Header oder zeigt er auf eine fremde
Herkunft, antwortet die Route mit 403 `ORIGIN`.
