// Builds the single-file game: inlines src/style.css and src/js/*.js into Tiny_Dominion.html
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const read = f => readFileSync(join(src, f), 'utf8');

const skip = (process.env.EXCLUDE || '').split(',').filter(Boolean);
const jsFiles = readdirSync(join(src, 'js')).filter(f => f.endsWith('.js') && !skip.includes(f)).sort();
const js = jsFiles.map(f => `/* ===== ${f} ===== */\n` + read(join('js', f))).join('\n');

const html = read('head.html').trimEnd() + '\n<style>\n' + read('style.css').trimEnd() + '\n</style>\n</head>\n<body>\n' +
  read('body.html').trimEnd() + '\n\n<script>\n(function(){\n\'use strict\';\n' + js.trimEnd() + '\n})();\n</script>\n</body>\n</html>\n';

// syntax check the combined script before writing anything
const tmp = join(mkdtempSync(join(tmpdir(), 'tdb-')), 'game.js');
writeFileSync(tmp, "(function(){'use strict';\n" + js + '\n})();\n');
const chk = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
if (chk.status !== 0) { console.error(chk.stderr); process.exit(1); }

const out = process.env.OUT || join(root, 'Tiny_Dominion.html');
writeFileSync(out, html);

// artifact flavour: the host wraps the page in its own document, so ship only title, fonts, style, body and script
if (!process.env.OUT) {
  const head = read('head.html');
  const keep = head.split('\n').filter(l => /<title>|<link /.test(l)).join('\n');
  const art = keep + '\n<style>\n' + read('style.css').trimEnd() + '\n</style>\n' + read('body.html').trimEnd() +
    '\n\n<script>\n(function(){\n\'use strict\';\n' + js.trimEnd() + '\n})();\n</script>\n';
  mkdirSync(join(root, 'dist'), { recursive: true });
  writeFileSync(join(root, 'dist', 'tiny-dominion.html'), art);
  console.log(`built dist/tiny-dominion.html (${(art.length / 1024).toFixed(1)} KB, artifact page)`);
}
console.log(`built ${out} (${(html.length / 1024).toFixed(1)} KB, ${jsFiles.length} js parts)`);
