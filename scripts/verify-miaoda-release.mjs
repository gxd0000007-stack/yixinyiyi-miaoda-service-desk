import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const releaseDir = resolve(root, 'release');
const manifest = JSON.parse(
  readFileSync(resolve(releaseDir, 'release-manifest.json'), 'utf8'),
);
const packagePath = resolve(releaseDir, manifest.package);
const bytes = readFileSync(packagePath);
const actualSha256 = createHash('sha256').update(bytes).digest('hex');
if (actualSha256 !== manifest.sha256) throw new Error('release SHA-256 mismatch');

const tested = spawnSync('unzip', ['-t', packagePath], { encoding: 'utf8' });
if (tested.status !== 0) throw new Error(`invalid ZIP: ${tested.stderr || tested.stdout}`);

const listed = spawnSync('zipinfo', ['-1', packagePath], { encoding: 'utf8' });
if (listed.status !== 0) throw new Error(`cannot list ZIP: ${listed.stderr}`);
const files = listed.stdout.split(/\r?\n/u).filter(Boolean);
for (const required of [
  'package.json',
  'store.manifest.json',
  'client/src/app.tsx',
  'server/app.module.ts',
  'server/database/schema.ts',
  'server/database/migrations/009_membership_discount_cash_voucher.sql',
]) {
  if (!files.includes(required)) throw new Error(`release is missing ${required}`);
}
for (const forbidden of ['.git/', 'node_modules/', 'dist/', 'release/', '.env']) {
  if (files.some((file) => file === forbidden || file.startsWith(forbidden))) {
    throw new Error(`release contains forbidden path ${forbidden}`);
  }
}
process.stdout.write(
  `verified ${manifest.package}\nfiles=${files.length}\nsha256=${actualSha256}\n`,
);
