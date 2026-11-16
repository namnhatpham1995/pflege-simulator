import { config as loadEnv } from 'dotenv';
import type { Actor } from '../src/lib/types';

/**
 * npm run db:reset-class-data -- --confirm RESET
 */
const teacher: Actor = { type: 'teacher', id: 'teacher', displayName: 'Lehrkraft' };

async function main(): Promise<void> {
  loadEnv({ path: ['.env.local', '.env'], quiet: true });

  const { RESET_CONFIRMATION } = await import('../src/lib/validation/reset');
  const args = process.argv.slice(2);
  const index = args.indexOf('--confirm');
  const confirm = index >= 0 ? args[index + 1] : undefined;

  if (confirm !== RESET_CONFIRMATION) {
    console.error(`Aufruf: npm run db:reset-class-data -- --confirm ${RESET_CONFIRMATION}`);
    process.exit(1);
  }

  const { resetClassData } = await import('../src/server/services/reset');
  const { closeDatabase } = await import('../src/db/client');

  const deleted = await resetClassData(teacher, confirm);
  console.log(
    `Gelöscht: ${deleted.vitals} Vitalwerte, ${deleted.reports} Pflegeberichte, ` +
      `${deleted.revisions} Fassungen, ${deleted.audit} Protokolleinträge.`,
  );
  await closeDatabase();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
