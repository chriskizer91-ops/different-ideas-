// Builds the single-file game: inlines src/style.css and src/js/*.js into Tiny_Dominion.html
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
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

const out = process.env.OUT || join(root, 'Tiny_Dominion.html');
writeFileSync(out, html);
console.log(`built ${out} (${(html.length / 1024).toFixed(1)} KB, ${jsFiles.length} js parts)`);
