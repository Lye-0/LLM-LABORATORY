import { execFileSync } from 'node:child_process';

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const blocked = tracked.filter(
  (name) =>
    (name.startsWith('docs/') && !name.startsWith('docs/public/')) ||
    /^(?:docd|\.private|\.kilo|\.agents|\.codex|node_modules|dist|test-results|playwright-report)\//.test(
      name,
    ) ||
    (/(?:^|\/)(?:\.env(?:\..+)?|id_rsa|id_ed25519)$/.test(name) &&
      !name.endsWith('.env.example')) ||
    /\.(?:bundle|pem|p12|pfx)$/.test(name),
);
if (blocked.length) {
  console.error('Files excluded from public distribution are tracked:\n' + blocked.join('\n'));
  process.exitCode = 1;
} else console.log(`Public file boundary passed (${tracked.length} tracked files).`);
