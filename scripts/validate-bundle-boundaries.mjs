import { readFileSync } from 'node:fs';

const protectedEntrypoints = [
  'src/main.tsx',
  'src/router.tsx',
  'src/routes/route-tree.ts',
  'src/routes/__root.tsx',
  'src/config/tools.ts',
];

const forbiddenStaticImports = [
  '@ffmpeg/core',
  '@ffmpeg/ffmpeg',
  'pdfjs-dist',
  'pdf-lib',
  'jspdf',
  'jszip',
  'recharts',
  'drizzle-orm',
  'postgres',
  'nodemailer',
];

const staticImportPattern = /(?:import\s+[^'"`]*?from\s*|import\s*\(\s*)['"`]([^'"`]+)['"`]/g;

const violations = [];

for (const file of protectedEntrypoints) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(staticImportPattern)) {
    const specifier = match[1];
    if (forbiddenStaticImports.some((dependency) => specifier === dependency || specifier.startsWith(`${dependency}/`))) {
      violations.push(`${file}: ${specifier}`);
    }
  }
}

if (violations.length > 0) {
  console.error('Bundle boundary violations detected:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Bundle boundaries OK (${protectedEntrypoints.length} entrypoints checked).`);
