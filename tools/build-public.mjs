// Готовит ./public для Cloudflare Workers Static Assets.
// Кладём туда только то, что нужно браузеру: без server.js, worker/ и .git.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const files = ['index.html', 'styles.css', 'README.md'];
for (const name of files) {
  const from = path.join(root, name);
  if (fs.existsSync(from)) fs.copyFileSync(from, path.join(out, name));
}

for (const dir of ['src', 'vendor']) {
  const from = path.join(root, dir);
  if (fs.existsSync(from)) fs.cpSync(from, path.join(out, dir), { recursive: true });
}

fs.writeFileSync(path.join(out, '.nojekyll'), '');

const size = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((sum, ent) => {
  const full = path.join(dir, ent.name);
  return sum + (ent.isDirectory() ? size(full) : fs.statSync(full).size);
}, 0);

console.log(`public/ ready — ${(size(out) / 1024).toFixed(1)} KB`);
