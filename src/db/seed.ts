import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { db as defaultDb, type Database } from './client';
import { patients } from './schema';

/**
 * Idempotent seed: exactly ten fictional patients with stable identifiers and
 * no stored date of birth. No groups or access codes are created any more, and
 * onConflictDoNothing keeps a teacher's edited name and date of birth.
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

export const SEED_PATIENT_COUNT = SEED_PATIENTS.length;

export interface SeedOptions {
  log?: (message: string) => void;
}

export interface SeedResult {
  patients: number;
  createdPatients: number;
}

export async function seedDatabase(
  database: Database = defaultDb,
  options: SeedOptions = {},
): Promise<SeedResult> {
  const now = new Date().toISOString();
  let createdPatients = 0;

  for (const patient of SEED_PATIENTS) {
    const inserted = await database
      .insert(patients)
      .values({
        id: patientIdFor(patient.slug),
        displayName: patient.displayName,
        createdAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: patients.id });
    createdPatients += inserted.length;
  }

  options.log?.(`Patienten: ${SEED_PATIENTS.length}, neu angelegt: ${createdPatients}`);

  return { patients: SEED_PATIENTS.length, createdPatients };
}

async function main(): Promise<void> {
  loadEnv({ path: ['.env.local', '.env'], quiet: true });
  const result = await seedDatabase(defaultDb, { log: (message) => console.log(message) });
  if (result.createdPatients === 0) {
    console.log('Alle Patienten existierten bereits; nichts geändert.');
  }
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
