import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, dirname, join, normalize, relative, resolve } from 'node:path';

const ROOT = process.cwd();
const DIST = resolve(process.env.FLIXO_GENERATED_OUTPUT_DIR?.trim() || 'dist');
const TEXT_EXTENSIONS = new Set(['.html', '.htm', '.js', '.mjs', '.cjs', '.css', '.map']);
const ASSET_EXTENSIONS = new Set(['.js', '.mjs', '.css', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.avif', '.woff', '.woff2', '.ttf', '.otf', '.json', '.wasm', '.mp4', '.webm', '.mp3', '.wav', '.pdf']);
const errors = [];
const checked = new Set();

if (!existsSync(DIST) || !statSync(DIST).isDirectory()) {
  console.error(`Asset validation cannot run: built output directory does not exist: ${relative(ROOT, DIST) || DIST}`);
  process.exit(1);
}

function collectFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(full));
    else files.push(full);
  }
  return files;
}

const files = collectFiles(DIST);
const textFiles = files.filter((file) => TEXT_EXTENSIONS.has(extname(file).toLowerCase()));
const htmlFiles = files.filter((file) => ['.html', '.htm'].includes(extname(file).toLowerCase()));

function stripQueryHash(value) {
  return value.split(/[?#]/u, 1)[0];
}

function isIgnorable(value) {
  const normalizedValue = value.trim();
  return !normalizedValue || normalizedValue.startsWith('#') || /^(?:data|blob|mailto|tel|javascript|about):/iu.test(normalizedValue) || normalizedValue.startsWith('//') || /^[a-z][a-z0-9+.-]*:/iu.test(normalizedValue);
}

function resolveLocalReference(raw, sourceFile) {
  const value = stripQueryHash(raw.trim());
  if (isIgnorable(value)) return null;
  let target;
  if (value.startsWith('/')) target = resolve(DIST, `.${value}`);
  else target = resolve(dirname(sourceFile), value);
  const normalizedTarget = normalize(target);
  if (!normalizedTarget.startsWith(`${DIST}${join('')}`) && normalizedTarget !== DIST) {
    return { raw, target: normalizedTarget, reason: 'escapes the built output root' };
  }
  return { raw, target: normalizedTarget, reason: 'missing' };
}

function assetLike(value) {
  const path = stripQueryHash(value.trim());
  return ASSET_EXTENSIONS.has(extname(path).toLowerCase()) || /(?:^|[/_-])(assets?|static|icons?|images?|fonts?)(?:[/_-]|$)/iu.test(path);
}

function verifyReference(raw, sourceFile) {
  const resolved = resolveLocalReference(raw, sourceFile);
  if (!resolved) return;
  if (resolved.reason !== 'missing') {
    errors.push(`${relative(ROOT, sourceFile)} -> ${raw}: ${resolved.reason}`);
    return;
  }
  const key = `${sourceFile}\0${resolved.target}`;
  if (checked.has(key)) return;
  checked.add(key);
  if (existsSync(resolved.target) && statSync(resolved.target).isFile()) return;
  const indexFile = join(resolved.target, 'index.html');
  if (existsSync(indexFile) && statSync(indexFile).isFile()) return;
  errors.push(`${relative(ROOT, sourceFile)} -> ${raw}: unresolved asset path ${relative(DIST, resolved.target)}`);
}

for (const file of textFiles) {
  const text = readFileSync(file, 'utf8');

  for (const match of text.matchAll(/<(?:script|img|source|video|audio|image|use)\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/giu)) verifyReference(match[1], file);
  for (const match of text.matchAll(/<(?:image|use)\b[^>]*?\b(?:href|xlink:href)\s*=\s*["']([^"']+)["']/giu)) verifyReference(match[1], file);
  for (const match of text.matchAll(/<link\b[^>]*?\brel\s*=\s*["']([^"']+)["'][^>]*?\bhref\s*=\s*["']([^"']+)["']/giu)) {
    if (/(?:stylesheet|icon|mask-icon|manifest|preload|modulepreload)/iu.test(match[1])) verifyReference(match[2], file);
  }
  for (const match of text.matchAll(/\b(?:src|href|poster)\s*=\s*["']([^"']+)["']/giu)) {
    if (assetLike(match[1])) verifyReference(match[1], file);
  }
  for (const match of text.matchAll(/\burl\(\s*["']?([^\)"']+)["']?\s*\)/giu)) verifyReference(match[1], file);
  for (const match of text.matchAll(/\b(?:import|fetch)\(\s*["']([^"']+)["']\s*\)/giu)) {
    if (assetLike(match[1]) || match[1].startsWith('/')) verifyReference(match[1], file);
  }
  for (const match of text.matchAll(/(?:new\s+URL\(\s*)?["'](\/(?:[^"']+))["']/gu)) {
    if (assetLike(match[1])) verifyReference(match[1], file);
  }

  for (const match of text.matchAll(/<(?:use|image)\b[^>]*?\b(?:href|xlink:href)\s*=\s*["']#([^"']+)["']/giu)) {
    const id = match[1];
    if (!new RegExp(`\\bid=["']${id.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}["']`, 'u').test(text)) {
      errors.push(`${relative(ROOT, file)}: SVG fragment #${id} has no matching id definition in the built document`);
    }
  }
}

for (const htmlFile of htmlFiles) {
  const html = readFileSync(htmlFile, 'utf8');
  const routeMatch = html.match(/<html\b[^>]*\blang=["']([^"']+)["']/iu);
  if (!routeMatch) errors.push(`${relative(ROOT, htmlFile)}: built route document has no lang attribute`);
}

if (errors.length) {
  console.error(`Asset-chain validation FAILED with ${errors.length} violation(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Asset-chain validation PASS: scanned ${textFiles.length} built text artifacts and ${htmlFiles.length} route documents; all local asset references resolve and inline SVG fragments have definitions.`);
