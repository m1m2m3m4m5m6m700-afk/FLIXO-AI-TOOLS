import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');

const forbiddenPaths = [
  'src/routes/admin.tsx',
  'src/routes/admin-login.tsx',
  'src/lib/admin/auth.ts',
  'src/lib/admin/config.ts',
  'src/lib/admin-surveys.ts',
  'src/lib/contracts/pdf-output.ts',
  'src/lib/ai-planner.ts',
  '.github/workflows/s4-runtime-e2e.yml',
];
for (const path of forbiddenPaths) assert.equal(existsSync(join(root, path)), false, `legacy path still exists: ${path}`);

const routeTree = read('src/routes/route-tree.ts');
assert.doesNotMatch(routeTree, /adminLoginRoute|adminRoute/, 'admin route remains registered');

const outputContract = read('src/lib/contracts/tool-output.ts');
assert.match(outputContract, /ToolOutputKind = 'image' \| 'svg' \| 'zip' \| 'text' \| 'json'/, 'output kind contract drifted');
assert.doesNotMatch(outputContract, /'pdf'|'csv'|'audio'|'video'/, 'legacy output kind remains');

const fileSafety = read('src/lib/contracts/file-safety.ts');
assert.doesNotMatch(fileSafety, /application\/pdf|audio\/|video\/|\.mp3|\.mp4|\.csv/, 'legacy G2 media format remains');

const g3 = read('scripts/test-g3-artifact-integrity.mjs');
assert.doesNotMatch(g3, /PDFDocument|application\/pdf|text\/csv|audio\/|video\//, 'legacy G3 format remains');
assert.match(g3, /g3-image-batch-package/, 'ZIP packaging coverage disappeared without an explicit contract decision');

const localization = read('src/lib/i18n/tool-localization.ts');
assert.doesNotMatch(localization, /\bzh\s*:/, 'unsupported zh locale remains in localization data');
assert.doesNotMatch(localization, /\bur\s*:/, 'unsupported ur locale remains in localization data');

const seo = read('src/lib/seo/tool-seo.ts');
assert.match(seo, /export type ToolCategory = 'Images'/, 'SEO taxonomy is not Image-only');
assert.doesNotMatch(seo, /'AI'|'Other'/, 'legacy SEO taxonomy remains');

const env = read('.env.example');
assert.doesNotMatch(env, /ADMIN_PASSWORD_HASH|ADMIN_SESSION_SECRET|DATABASE_URL|SMTP_HOST|SMTP_PORT|SMTP_USER|SMTP_PASS|NOTIFY_TO/, 'admin infrastructure environment surface remains');

const packageJson = JSON.parse(read('package.json'));
const directDependencies = new Set([...Object.keys(packageJson.dependencies ?? {}), ...Object.keys(packageJson.devDependencies ?? {})]);
for (const dependency of [
  '@ffmpeg/core', '@ffmpeg/ffmpeg', 'gif.js', 'gifuct-js', '@types/gif.js',
  'jspdf', 'pdf-lib', 'pdfjs-dist', 'nodemailer', '@types/nodemailer',
  'drizzle-orm', 'postgres', 'qrcode', '@types/qrcode',
  '@hookform/resolvers', 'react-hook-form', '@tanstack/react-query',
  'cmdk', 'date-fns', 'embla-carousel-react', 'input-otp', 'react-day-picker',
  'react-resizable-panels', 'sonner', 'vaul',
]) assert.equal(directDependencies.has(dependency), false, `legacy/unconsumed direct dependency remains: ${dependency}`);

console.log('Image-only legacy closure contract passed.');
