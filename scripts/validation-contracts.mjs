import { readFileSync } from 'node:fs';

const configSource = readFileSync('src/lib/i18n/config.ts', 'utf8');
const localeList = configSource.match(/export const LOCALES = \[([\s\S]*?)\] as const/);

if (!localeList) {
  console.error('Validation contracts failed: canonical LOCALES registry is missing from src/lib/i18n/config.ts');
  process.exit(1);
}

export const CANONICAL_LOCALES = localeList[1].match(/'([a-z]{2})'/g)?.map((value) => value.slice(1, -1)) ?? [];

if (CANONICAL_LOCALES.length === 0) {
  console.error('Validation contracts failed: canonical LOCALES registry is empty');
  process.exit(1);
}

export function failValidation(message) {
  console.error(`Validation gate failed: ${message}`);
  process.exit(1);
}
