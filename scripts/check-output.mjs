import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
      ),
    )
  ).flat();
}
const files = await walk('dist');
const html = files.filter((f) => f.endsWith('.html'));
const errors = [];
const base = (process.env.SITE_BASE || '/').replace(/\/$/, '');
for (const filename of html) {
  const body = await readFile(filename, 'utf8');
  for (const match of body.matchAll(/(?:href|src)="(\/[^"?#]*)(?:[?#][^"]*)?"/g)) {
    let target;
    try {
      target = decodeURIComponent(match[1]);
    } catch {
      errors.push(`${filename}: malformed URL`);
      continue;
    }
    if (target.startsWith('//')) continue;
    if (base) {
      if (target === base) target = '/';
      else if (target.startsWith(`${base}/`)) target = target.slice(base.length);
      else {
        errors.push(`${filename}: URL outside site base: ${match[1]}`);
        continue;
      }
    }
    let resolved = path.join('dist', target);
    try {
      if ((await stat(resolved)).isDirectory()) resolved = path.join(resolved, 'index.html');
      await stat(resolved);
    } catch {
      errors.push(`${filename} → ${match[1]}`);
    }
  }
  if (/chatgpt-conversation:|Users[\\/][^\\/]+[\\/]|Notion学習ページのまとめ方/.test(body))
    errors.push(`${filename}: private reference leaked`);
  if (!body.includes('lang="ja"')) errors.push(`${filename}: lang missing`);
}
const lessons = await readdir('src/content/lessons');
if (lessons.length !== 29) errors.push(`Expected 29 lessons, got ${lessons.length}`);
if (files.some((f) => f.replaceAll('\\', '/').startsWith('dist/docs/')))
  errors.push('docs must not be published');
const js = files.filter((f) => f.endsWith('.js') && f.includes('_astro'));
const sizes = await Promise.all(
  js.map(async (f) => ({ file: path.basename(f), gzip: gzipSync(await readFile(f)).length })),
);
console.log(`Checked ${html.length} static pages, ${lessons.length} lessons and internal links.`);
console.log('Largest JS chunks (gzip bytes):', sizes.sort((a, b) => b.gzip - a.gzip).slice(0, 5));
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log('Static output checks passed.');
