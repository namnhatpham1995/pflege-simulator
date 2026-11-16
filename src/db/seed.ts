import { mkdirSync, openSync, writeSync, closeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { eq } from 'drizzle-orm';
import { config as loadEnv } from 'dotenv';
import { db as defaultDb, type Database } from './client';
import { measurementRequirements, patients, studentGroups } from './schema';
import { VITAL_FIELDS } from '../lib/types';
import { generateAccessCode, hashPassword } from '../server/auth/password';

/**
 * Idempotent seed: exactly ten fictional patients, ten groups and the default
 * measurement policy. Re-running never invalidates an access code that was
 * already handed out; codes are only produced for newly created groups.
 */

const NAMESPACE = '0f6b7d8e-3c21-4f8a-9b57-2d9f4c1a6e30';

interface SeedPatient {
  slug: string;
  displayName: string;
}

const SEED_PATIENTS: SeedPatient[] = [
  { slug: 'albrecht', displayName: 'Frau Albrecht (Zimmer 101)' },
  { slug: 'brandt', displayName: 'Herr Brandt (Zimmer 102)' },
  { slug: 'czerwenka', displayName: 'Frau Czerwenka (Zimmer 103)' },
  { slug: 'dorn', displayName: 'Herr Dorn (Zimmer 104)' },
  { slug: 'ebert', displayName: 'Frau Ebert (Zimmer 105)' },
  { slug: 'fahimi', displayName: 'Herr Fahimi (Zimmer 106)' },
  { slug: 'gerlach', displayName: 'Frau Gerlach (Zimmer 107)' },
  { slug: 'hoffmann', displayName: 'Herr Hoffmann (Zimmer 108)' },
  { slug: 'iwanowa', displayName: 'Frau Iwanowa (Zimmer 109)' },
  { slug: 'jansen', displayName: 'Herr Jansen (Zimmer 110)' },
];

const DEFAULT_EXPECTED_FIELDS = new Set(['systolic', 'diastolic', 'pulse']);

function uuidv5(name: string, namespace = NAMESPACE): string {
  const namespaceBytes = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1')
    .update(namespaceBytes)
    .update(Buffer.from(name, 'utf8'))
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function patientIdFor(slug: string): string {
  return uuidv5(`patient:${slug}`);
}

export function groupIdFor(position: number): string {
  return uuidv5(`group:${position}`);
}

export function groupNameFor(position: number): string {
  return `Gruppe ${position}`;
}

export interface SeedCode {
  groupId: string;
  groupName: string;
  code: string;
  kind: 'created' | 'rotated';
}

export interface SeedOptions {
  /** Group display name, group id or patient slug whose code should be regenerated. */
  rotate?: string;
  writeCodeFile?: boolean;
  log?: (message: string) => void;
}

export interface SeedResult {
  createdGroups: number;
  codes: SeedCode[];
  patients: number;
  requirements: number;
}

export const GROUP_CODES_FILE = path.join('.local', 'group-codes.txt');

export async function seedDatabase(
  database: Database = defaultDb,
  options: SeedOptions = {},
): Promise<SeedResult> {
  const now = new Date().toISOString();
  const log = options.log ?? (() => undefined);
  const writeCodeFile = options.writeCodeFile ?? true;
  const codes: SeedCode[] = [];

  for (const patient of SEED_PATIENTS) {
    await database
      .insert(patients)
      .values({
        id: patientIdFor(patient.slug),
        displayName: patient.displayName,
        createdAt: now,
      })
      .onConflictDoNothing();
  }

  for (const patient of SEED_PATIENTS) {
    for (const field of VITAL_FIELDS) {
      await database
        .insert(measurementRequirements)
        .values({
          patientId: patientIdFor(patient.slug),
          field,
          isExpected: DEFAULT_EXPECTED_FIELDS.has(field) ? 1 : 0,
        })
        .onConflictDoNothing();
    }
  }

  const existingGroups = await database
    .select({ id: studentGroups.id })
    .from(studentGroups);
  const existingIds = new Set(existingGroups.map((row) => row.id));

  let createdGroups = 0;
  for (let position = 1; position <= SEED_PATIENTS.length; position += 1) {
    const id = groupIdFor(position);
    if (existingIds.has(id)) continue;

    const patient = SEED_PATIENTS[position - 1]!;
    const code = generateAccessCode();
    await database.insert(studentGroups).values({
      id,
      displayName: groupNameFor(position),
      patientId: patientIdFor(patient.slug),
      accessCodeHash: hashPassword(code),
      isActive: 1,
    });
    createdGroups += 1;
    codes.push({ groupId: id, groupName: groupNameFor(position), code, kind: 'created' });
  }

  if (options.rotate) {
    const match = await findGroup(database, options.rotate);
    if (!match) {
      throw new Error(`Keine Gruppe gefunden für "${options.rotate}".`);
    }
    const code = generateAccessCode();
    await database
      .update(studentGroups)
      .set({ accessCodeHash: hashPassword(code) })
      .where(eq(studentGroups.id, match.id));
    codes.push({ groupId: match.id, groupName: match.displayName, code, kind: 'rotated' });
  }

  if (codes.length > 0) {
    for (const entry of codes) {
      log(`${entry.groupName}: ${entry.code}`);
    }
    if (writeCodeFile) writeGroupCodesFile(codes);
  }

  return {
    createdGroups,
    codes,
    patients: SEED_PATIENTS.length,
    requirements: SEED_PATIENTS.length * VITAL_FIELDS.length,
  };
}

async function findGroup(
  database: Database,
  selector: string,
): Promise<{ id: string; displayName: string } | null> {
  const rows = await database
    .select({ id: studentGroups.id, displayName: studentGroups.displayName })
    .from(studentGroups);
  const normalized = selector.trim().toLowerCase();
  return (
    rows.find(
      (row) =>
        row.id === selector ||
        row.displayName.toLowerCase() === normalized ||
        row.displayName.toLowerCase().replace(/\s+/g, '') === normalized.replace(/\s+/g, ''),
    ) ?? null
  );
}

function writeGroupCodesFile(codes: SeedCode[]): void {
  mkdirSync('.local', { recursive: true });
  const contents =
    '# Zugangscodes der Lerngruppen – einmalig erzeugt, nicht erneut abrufbar.\n' +
    '# Vertraulich behandeln und nicht in das Repository aufnehmen.\n' +
    codes
      .map((entry) => `${entry.groupName}\t${entry.groupId}\t${entry.code}\t(${entry.kind})`)
      .join('\n') +
    '\n';

  const fd = openSync(GROUP_CODES_FILE, 'w', 0o600);
  try {
    writeSync(fd, contents);
  } finally {
    closeSync(fd);
  }
}

function parseArgs(argv: string[]): SeedOptions {
  const options: SeedOptions = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--rotate') {
      options.rotate = argv[index + 1];
      index += 1;
    } else if (arg?.startsWith('--rotate=')) {
      options.rotate = arg.slice('--rotate='.length);
    } else if (arg === '--no-file') {
      options.writeCodeFile = false;
    }
  }
  return options;
}

async function main(): Promise<void> {
  loadEnv({ path: ['.env.local', '.env'], quiet: true });
  const options = parseArgs(process.argv.slice(2));
  const result = await seedDatabase(defaultDb, {
    ...options,
    log: (message) => console.log(message),
  });

  console.log(`Patienten: ${result.patients}, neue Gruppen: ${result.createdGroups}`);
  if (result.codes.length === 0) {
    console.log('Alle Gruppen existierten bereits; keine neuen Codes erzeugt.');
  } else {
    console.log(`Codes zusätzlich in ${GROUP_CODES_FILE} gespeichert (gitignoriert).`);
  }
  console.log('Hinweis: Verlorene Codes lassen sich nur über --rotate neu setzen.');
}

const invokedDirectly =
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
