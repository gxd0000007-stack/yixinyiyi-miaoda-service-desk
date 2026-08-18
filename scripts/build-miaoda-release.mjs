import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const releaseDir = resolve(root, 'release');
const manifest = JSON.parse(readFileSync(resolve(root, 'store.manifest.json'), 'utf8'));
const packageName = `miaoda-yixinyiyi-v${manifest.version}.zip`;
const packagePath = resolve(releaseDir, packageName);
const releaseManifestPath = resolve(releaseDir, 'release-manifest.json');

mkdirSync(releaseDir, { recursive: true });
rmSync(packagePath, { force: true });
rmSync(releaseManifestPath, { force: true });

const excluded = [
  '.git/*',
  '.github/*',
  'node_modules/*',
  'dist/*',
  'release/*',
  'coverage/*',
  'test/*',
  'docs/*',
  'AGENTS.md',
  'INSTALL.md',
  'README.md',
  'tsconfig.test.json',
  '.env',
  '.env.*',
  '*.store-backup.json',
  '*.store-backup.enc',
];
const zip = spawnSync(
  'zip',
  ['-qr', packagePath, '.', ...excluded.flatMap((item) => ['-x', item])],
  { cwd: root, encoding: 'utf8' },
);
if (zip.status !== 0) {
  throw new Error(`zip failed: ${zip.stderr || zip.stdout}`);
}

const bytes = readFileSync(packagePath);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const releaseManifest = {
  productId: manifest.productId,
  version: manifest.version,
  package: packageName,
  sizeBytes: bytes.length,
  sha256,
  generatedAt: new Date().toISOString(),
  backupFormat: manifest.backupFormat,
  backupFormatVersion: manifest.backupFormatVersion,
  schemaVersion: manifest.schemaVersion,
};
writeFileSync(releaseManifestPath, `${JSON.stringify(releaseManifest, null, 2)}\n`);
process.stdout.write(`${packagePath}\nsha256=${sha256}\n`);
