import { execFileSync } from 'node:child_process';

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
// Keep this explicit allowlist in sync with .gitignore after reviewing each document.
const sharedDocs = new Set([
  'docs/public/README.md',
  'docs/public/product.md',
  'docs/public/curriculum.md',
  'docs/public/content-guide.md',
  'docs/public/design.md',
  'docs/public/architecture.md',
  'docs/public/development.md',
  'docs/public/references.md',
]);
const blocked = tracked.filter(
  (name) =>
    (name.startsWith('docs/') && !sharedDocs.has(name)) ||
    /^(?:docd|\.private|\.kilo|\.agents|\.codex|node_modules|dist|test-results|playwright-report)\//.test(
      name,
    ) ||
    (/(?:^|\/)(?:\.env(?:\..+)?|id_rsa|id_ed25519)$/.test(name) &&
      !name.endsWith('.env.example')) ||
    /\.(?:bundle|pem|p12|pfx)$/.test(name),
);
for (const name of tracked.filter((file) => sharedDocs.has(file))) {
  // Inspect the staged/checked-out Git blob, rather than a possibly different working copy.
  const content = execFileSync('git', ['show', `:${name}`], { encoding: 'utf8' });
  if (
    /chatgpt-conversation:\/\/|https:\/\/(?:app\.)?notion\.(?:com|so)\//i.test(content) ||
    /[A-Z]:[\\/]Users[\\/]|\/home\/[^/\s]+\//.test(content) ||
    /gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/.test(
      content,
    )
  )
    blocked.push(`${name} (private-reference or credential-like content)`);
}
if (blocked.length) {
  console.error('Files excluded from public distribution are tracked:\n' + blocked.join('\n'));
  process.exitCode = 1;
} else console.log(`Public file boundary passed (${tracked.length} tracked files).`);
