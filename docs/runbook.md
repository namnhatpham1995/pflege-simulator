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

- `db:migrate` spielt `drizzle/` ein und ist wiederholbar.
- `db:seed` legt zehn fiktive Patienten, zehn Gruppen und 80 Erwartungszeilen an. Es ist
  idempotent: bestehende Gruppen behalten ihren Code.
- Neue Codes werden **einmalig** auf stdout ausgegeben und in `.local/group-codes.txt`
  (gitignoriert, Modus 0600) abgelegt. Danach sind sie nicht mehr abrufbar; verlorene Codes
  nur über `npm run db:seed -- --rotate "Gruppe 4"` ersetzen.

## 3. Vercel

Umgebungsvariablen im Projekt (Production und Preview getrennt prüfen):

| Variable | Pflicht | Zweck |
|---|---|---|
| `TURSO_DATABASE_URL` | ja | libSQL-URL der Produktionsdatenbank |
| `TURSO_AUTH_TOKEN` | ja | Token für genau diese Datenbank |
| `SESSION_SECRET` | ja | Pepper für Session-Hashes, mindestens 32 Zeichen |
| `TEACHER_PASSWORD_HASH` | ja | scrypt-Hash aus `npm run hash-password` |
| `TEACHER_DISPLAY_NAME` | nein | Anzeigename, Standard „Lehrkraft“ |

Ablauf: Branch nach `main` mergen → Vercel baut → `npm run db:migrate` **vor** dem ersten
Login gegen die Produktionsdatenbank ausführen → `npm run db:seed` einmalig → zehn Codes
sicher an die Gruppen verteilen.

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
turso db shell pflege-restore "SELECT COUNT(*) FROM student_groups;" # 10
```

Erst wenn die Zählungen stimmen, die Anwendung auf die Scratch-URL zeigen lassen
(`TURSO_DATABASE_URL` in einer Preview-Umgebung) und dort einen Login testen. Niemals direkt
in die Produktionsdatenbank zurückspielen, ohne vorher ein aktuelles Backup zu ziehen.

## 6. Rollback

1. Vercel → Deployments → vorheriges Deployment „Promote to Production“.
2. Bei Datenproblemen: Scratch-Restore prüfen, dann Produktion aus dem Backup neu aufbauen
   (neue Datenbank anlegen, Restore einspielen, `TURSO_DATABASE_URL` umstellen).
3. `db:migrate` ist additiv; ein Rollback der Anwendung ohne Schema-Rollback ist der Normalfall.

## 7. Semesterwechsel

```bash
npm run db:reset-class-data -- --confirm RESET
```

Löscht Vitalwerte, Pflegeberichte, Fassungen und Auditzeilen. Patienten, Gruppen, Codes und
Erwartungen bleiben. Alternativ die Lehrkraft-Konsole verwenden; beide Wege rufen denselben
Service auf.

## Status der Rehearsals

- Lokal verifiziert: Migration, Seed, `db:reset-class-data` gegen `file:./.local/e2e.db`.
- **Nicht verifiziert:** Turso-Provisionierung, `.dump`-Backup und Restore (Aufgabe 8.9).
  Dafür fehlen Turso-Zugangsdaten; die Kommandos oben sind dokumentiert, aber in dieser
  Umgebung nicht ausgeführt.
