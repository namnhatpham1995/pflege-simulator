# Zugang und Sitzungen

## Offener Übungsbetrieb

Studierende brauchen keine Anmeldung. Die Startseite bietet einen primären **Start**-Knopf,
der die Liste aller zehn fiktiven Patienten öffnet. Jeder Besucher darf jeden Patienten lesen
und dessen Messwerte und Pflegeberichte anlegen, ändern oder löschen. Die Lehrkraft liest nur.

Das ist eine bewusste Entscheidung für einen Übungssimulator mit ausschließlich erfundenen
Daten. Schutzmechanismen bleiben: `Origin`-Prüfung bei jeder schreibenden Anfrage, gedrosselte
Lehrkraft-Anmeldung, Audit-Zeilen für jede Änderung und der Klassendaten-Reset.

## Lehrkraft-Anmeldung

Nur die Lehrkraft meldet sich an: `POST /api/auth/login` mit `{ "password": "…" }`. Geprüft
wird gegen `TEACHER_PASSWORD` aus der Server-Umgebung geprüft (zeitkonstanter Vergleich). Es gibt keine
Mindestlänge und keine Komplexitätsregel – ein kurzer Merksatz genügt.

Fehlermeldungen sind absichtlich generisch („Das Passwort ist falsch.“); die Antwort verrät
nicht, ob ein Konto existiert.

`TEACHER_PASSWORD` steht im Klartext in der Server-Umgebung (lokal `.env.local`, produktiv
Vercel-Projektvariablen), nie in einer `NEXT_PUBLIC_`-Variable und nie im Repository. Ändern:
Variable anpassen und neu deployen.

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
- Alte Gruppen-Sitzungen aus früheren Versionen werden ignoriert; `sessions.actor_type` ist
  nur noch `teacher`. Die Tabelle `student_groups` bleibt unbenutzt bestehen.

## Drosselung

`login_attempts` speichert feste Fenster pro Schlüssel:

| Schlüssel | Grenze | Zweck |
|---|---|---|
| `code:teacher` | 5 Fehlversuche / 5 Minuten | Schutz vor Durchprobieren |
| `ip:<sha256(adresse)>` | 60 Fehlversuche / 10 Minuten | Schutz über viele Clients |

Der fünfte Fehlversuch im Fenster antwortet mit `429` und `Retry-After`. Eine erfolgreiche
Anmeldung löscht das Fenster des Lehrkraft-Schlüssels; ein korrektes Passwort hebt eine
bereits erschöpfte Sperre nicht auf.

## Autorisierung

`requirePatientAccess(patientId)` ist der einzige Prüfpfad für Server-Komponenten und
Route-Handler. Es prüft nur, dass der Patient existiert (sonst 404), und liefert für eine
gültige Lehrkraft-Sitzung den Lehrkraft-Aktor, sonst den anonymen Studierenden
`('group', 'patient:<patientId>')`.

`assertStudentWrite(actor)` weist die Lehrkraft mit `403 FORBIDDEN` ab. `requireTeacher`
schützt die Lehrkraft-Konsole, den Patienten-PATCH und den Klassendaten-Reset und antwortet
ohne Sitzung mit `401`. Jede schreibende Route ruft zusätzlich `assertSameOrigin(request)`
auf: fehlt der `Origin`-Header oder zeigt er auf eine fremde Herkunft, antwortet die Route mit
`403 ORIGIN`.
