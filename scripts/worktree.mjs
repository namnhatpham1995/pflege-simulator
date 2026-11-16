#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

/**
 * Creates a git worktree with its own dev port and its own database file so two
 * checkouts never collide. Uses Node APIs only; no POSIX shell assumptions.
 *
 *   node scripts/worktree.mjs create feat/vitals-data
 *   node scripts/worktree.mjs remove feat/vitals-data
 *   node scripts/worktree.mjs list
 */

const root = process.cwd();
const worktreesDir = path.join(root, '.worktrees');
const BASE_PORT = 3100;

function branchToFolder(branch) {
  return branch.replace(/[\\/]+/g, '-');
}

function existingSlots() {
  if (!existsSync(worktreesDir)) return [];
  return readdirSync(worktreesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(worktreesDir, entry.name, '.slot'))
    .filter((slotPath) => existsSync(slotPath))
    .map((slotPath) => Number(readFileSync(slotPath, 'utf8').trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function nextSlot() {
  const used = new Set(existingSlots());
  let slot = 1;
  while (used.has(slot)) slot += 1;
  return slot;
}

function run(command, args, options = {}) {
  // No shell: avoids argument-escaping issues and the DEP0190 warning on Windows.
  const executable = process.platform === 'win32' && command === 'npm' ? 'npm.cmd' : command;
  const result = spawnSync(executable, args, {
    cwd: options.cwd ?? root,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} ist mit Status ${result.status} beendet worden.`);
  }
}

function readRootSecret(key) {
  const envPath = path.join(root, '.env.local');
  if (!existsSync(envPath)) return null;
  const match = new RegExp(`^${key}=(.*)$`, 'm').exec(readFileSync(envPath, 'utf8'));
  return match ? match[1].trim() : null;
}

function createWorktree(branch) {
  if (!branch) {
    console.error('Aufruf: node scripts/worktree.mjs create <branch>');
    process.exit(1);
  }
  const folder = branchToFolder(branch);
  const target = path.join(worktreesDir, folder);
  if (existsSync(target)) {
    console.error(`Worktree ${target} existiert bereits.`);
    process.exit(1);
  }

  mkdirSync(worktreesDir, { recursive: true });
  const slot = nextSlot();
  const port = BASE_PORT + slot;

  const branchCheck = spawnSync('git', ['rev-parse', '--verify', '--quiet', branch], {
    cwd: root,
  });
  const branchExists = branchCheck.status === 0;
  run('git', branchExists ? ['worktree', 'add', target, branch] : ['worktree', 'add', '-b', branch, target]);

  writeFileSync(path.join(target, '.slot'), `${slot}\n`);

  const secret = readRootSecret('SESSION_SECRET');
  const envLines = [
    `PORT=${port}`,
    `DATABASE_URL=file:./.local/wt-${slot}.db`,
    `APP_ORIGIN=http://localhost:${port}`,
    secret ? `SESSION_SECRET=${secret}` : null,
  ].filter(Boolean);
  writeFileSync(path.join(target, '.env.local'), `${envLines.join('\n')}\n`);

  if (process.env.WORKTREE_SKIP_INSTALL !== '1') {
    run('npm', ['install'], { cwd: target });
  } else {
    console.log('WORKTREE_SKIP_INSTALL=1: npm install übersprungen.');
  }

  console.log(`\nWorktree bereit: ${target}`);
  console.log(`  Port:      ${port}`);
  console.log(`  Datenbank: file:./.local/wt-${slot}.db`);
}

function removeWorktree(branch) {
  if (!branch) {
    console.error('Aufruf: node scripts/worktree.mjs remove <branch>');
    process.exit(1);
  }
  const target = path.join(worktreesDir, branchToFolder(branch));
  if (!existsSync(target)) {
    console.error(`Worktree ${target} existiert nicht.`);
    process.exit(1);
  }
  run('git', ['worktree', 'remove', '--force', target]);
  rmSync(target, { recursive: true, force: true });
  console.log(`Worktree entfernt: ${target}`);
}

function listWorktrees() {
  if (!existsSync(worktreesDir)) {
    console.log('Keine Worktrees.');
    return;
  }
  for (const entry of readdirSync(worktreesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const slotPath = path.join(worktreesDir, entry.name, '.slot');
    const slot = existsSync(slotPath) ? readFileSync(slotPath, 'utf8').trim() : '?';
    console.log(`${entry.name}  slot=${slot}  port=${BASE_PORT + Number(slot)}`);
  }
}

const [command, branch] = process.argv.slice(2);
switch (command) {
  case 'create':
  case undefined:
    createWorktree(branch);
    break;
  case 'remove':
    removeWorktree(branch);
    break;
  case 'list':
    listWorktrees();
    break;
  default:
    console.error(`Unbekannter Befehl: ${command}`);
    process.exit(1);
}
