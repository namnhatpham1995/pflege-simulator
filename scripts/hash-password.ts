import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { hashPassword } from '../src/server/auth/password';

/**
 * Usage:
 *   npm run hash-password -- "mein Passwort"          print a scrypt hash
 *   npm run hash-password -- --write                  hash a generated teacher
 *                                                     password and write it to
 *                                                     .env.local + .local/teacher-credentials.txt
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--write')) {
    const password =
      process.env.TEACHER_PASSWORD ??
      `lehrer-${randomBytes(6).toString('hex')}`;
    const hash = hashPassword(password);
    upsertEnvLocal({
      SESSION_SECRET: process.env.SESSION_SECRET ?? randomBytes(32).toString('hex'),
      TEACHER_PASSWORD_HASH: hash,
    });
    mkdirSync('.local', { recursive: true });
    const credentialsPath = '.local/teacher-credentials.txt';
    writeFileSync(credentialsPath, `Lehrkraft-Passwort: ${password}\n`, { mode: 0o600 });
    console.log(`TEACHER_PASSWORD_HASH wurde in .env.local geschrieben.`);
    console.log(`Das Passwort steht einmalig in ${credentialsPath}.`);
    return;
  }

  if (args.length > 0 && !args[0]?.startsWith('-')) {
    console.log(hashPassword(args[0]!));
    return;
  }

  const readline = createInterface({ input: stdin, output: stdout });
  const answer = await readline.question('Neues Lehrkraft-Passwort: ');
  readline.close();
  if (!answer.trim()) {
    console.error('Kein Passwort eingegeben.');
    process.exit(1);
  }
  console.log(hashPassword(answer.trim()));
}

function upsertEnvLocal(values: Record<string, string>): void {
  const path = '.env.local';
  if (!existsSync(path)) {
    const initial = Object.entries(values)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    writeFileSync(path, `${initial}\n`, { mode: 0o600 });
    return;
  }
  let contents = readFileSync(path, 'utf8');
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    if (pattern.test(contents)) {
      contents = contents.replace(pattern, line);
    } else {
      contents = contents.endsWith('\n') ? `${contents}${line}\n` : `${contents}\n${line}\n`;
    }
  }
  writeFileSync(path, contents, { mode: 0o600 });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
