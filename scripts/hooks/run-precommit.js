const { execFileSync } = require('node:child_process');

function git(args, options = {}) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });
}

git(['diff', '--cached', '--check']);

const stagedFiles = git(
  ['diff', '--cached', '--name-only', '--diff-filter=ACMR'],
  { capture: true },
)
  .split('\n')
  .filter(Boolean);

const forbiddenFiles = stagedFiles.filter(
  (file) => {
    const basename = file.split('/').at(-1) ?? file;
    return (
      /^\.env(?:\.|$)/.test(basename) ||
      /^store-backup(?:-[^/]*)?\.(?:json|enc|decrypted)$/.test(basename) ||
      /(?:^|\/)release\//.test(file)
    );
  },
);

if (forbiddenFiles.length > 0) {
  process.stderr.write(
    `Refusing to commit private runtime data:\n${forbiddenFiles
      .map((file) => `- ${file}`)
      .join('\n')}\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `Pre-commit checks passed (${stagedFiles.length} staged files).\n`,
);
