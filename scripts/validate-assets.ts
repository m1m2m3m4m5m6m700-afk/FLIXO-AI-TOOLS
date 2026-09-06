import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.env.FLIXO_GENERATED_OUTPUT_DIR ?? 'dist');
const failures: string[] = [];

function fail(message: string): void { failures.push(message); }
function isExternalReference(value: string): boolean { return /^(?:[a-z][a-z\d+.-]*:|\/\/|data:|blob:|#|mailto:|tel:)/iu.test(value); }
function isDynamicReference(value: string): boolean { return value.includes('${'); }
function normalizeReference(value: string): string { return value.split(/[?#]/u, 1)[0]; }

function verifyReference(rawValue: string, file: string): void {
  const value = normalizeReference(rawValue.trim());
  if (!value || isExternalReference(value) || isDynamicReference(value)) return;
  const target = value.startsWith('/') ? path.resolve(ROOT, `.${value}`) : path.resolve(path.dirname(file), value);
  const relativeTarget = path.relative(ROOT, target);
  if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
    fail(`${path.relative(ROOT, file)}: local asset reference escapes built output: ${rawValue}`);
    return;
  }
  if (!fs.existsSync(target)) fail(`${path.relative(ROOT, file)}: unresolved local asset reference: ${rawValue}`);
}

function scanHtml(file: string, html: string): void {
  for (const match of html.matchAll(/\b(?:src|href|poster|srcset)\s*=\s*["']([^"']+)["']/giu)) {
    const value = match[1];
    if (value.includes(',')) {
      for (const candidate of value.split(',').map((item) => item.trim().split(/\s+/u)[0])) verifyReference(candidate, file);
    } else verifyReference(value, file);
  }
  for (const match of html.matchAll(/(?:href|xlink:href)\s*=\s*["']#([^"']+)["']/giu)) {
    const escapedId = match[1].replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    if (!new RegExp(`\\bid=["']${escapedId}["']`, 'u').test(html)) fail(`${path.relative(ROOT, file)}: SVG fragment #${match[1]} has no matching id definition in the built document`);
  }
}

function scanCss(file: string, css: string): void {
  for (const match of css.matchAll(/url\(\s*(?:["']([^"']+)["']|([^)]\s+)+)\s*\)/giu)) verifyReference(match[1] ?? match[2], file);
}

function scanJs(file: string, js: string): void {
  for (const match of js.matchAll(/\bnew\s+URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url\s*\)/giu)) verifyReference(match[1], file);
  for (const match of js.matchAll(/\b(?:import|fetch)\(\s*["'](\.?\/?[^"']+)["']/giu)) verifyReference(match[1], file);
  for (const match of js.matchAll(/["'`]\/(?:assets|icons|images|fonts|media)\/[^"'`\s?#]+/giu)) verifyReference(match[0].slice(1), file);
}

function visit(dir: string): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { visit(file); continue; }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!['.html', '.htm', '.css', '.js', '.mjs', '.cjs'].includes(ext)) continue;
    const source = fs.readFileSync(file, 'utf8');
    if (ext === '.html' || ext === '.htm') scanHtml(file, source);
    else if (ext === '.css') scanCss(file, source);
    else scanJs(file, source);
  }
}

if (!fs.existsSync(ROOT) || !fs.statSync(ROOT).isDirectory()) fail(`built output directory does not exist: ${ROOT}`);
else visit(ROOT);

if (failures.length) {
  console.error(`asset-chain validation FAILED: ${failures.length} unresolved reference(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('asset-chain validation PASS: all scanned local HTML/CSS/JS asset references resolve within built output.');
