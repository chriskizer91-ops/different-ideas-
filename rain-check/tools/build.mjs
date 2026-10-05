// Builds the single-file app: bundles src/main.jsx with esbuild and inlines it,
// with src/styles.css, into src/index.html, writing rain-check.html.
// The app code stays unminified so the built file can still be read.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => join(root, 'src', f);

const result = await build({
  entryPoints: [src('main.jsx')],
  bundle: true,
  write: false,
  format: 'iife',
  target: 'es2020',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  legalComments: 'eof',
  charset: 'utf8',
  logLevel: 'warning',
});

const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(src('styles.css'), 'utf8').trimEnd();
const shell = readFileSync(src('index.html'), 'utf8');
if (!shell.includes('/*STYLE*/') || !shell.includes('/*SCRIPT*/')) throw new Error('index.html is missing its placeholders');
const html = shell.replace('/*STYLE*/', () => css).replace('/*SCRIPT*/', () => js.trimEnd());

const out = process.env.OUT || join(root, 'rain-check.html');
writeFileSync(out, html);
console.log(`built ${out} (${(html.length / 1024).toFixed(1)} KB)`);
