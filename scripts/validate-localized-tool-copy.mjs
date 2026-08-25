import { readFileSync } from 'node:fs';

const source = readFileSync('src/routes/localized-tool-page.tsx', 'utf8');
const forbidden = [
  "aria-label=\"FLIXO tool navigation\"",
  "? 'English' : 'العربية'",
  "? 'جاهزة' : 'Ready'",
  "? 'مساحة عمل الأداة' : 'Tool workspace'",
  "? 'المفضلة' : 'Favorite'",
];

const found = forbidden.filter((token) => source.includes(token));
if (found.length) {
  console.error(`Localized tool page still contains hardcoded copy: ${found.join(', ')}`);
  process.exit(1);
}

console.log('Localized tool copy guard passed.');
