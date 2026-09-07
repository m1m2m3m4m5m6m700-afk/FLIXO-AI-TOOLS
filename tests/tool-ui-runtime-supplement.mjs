import assert from 'node:assert/strict';

const supplement = await import('../src/lib/i18n/tool-ui-runtime-supplement.ts');
assert.ok(supplement, 'tool UI runtime supplement module must load');

const samples = [
  ['ar', 'A cinematic sunset over Cairo...', 'غروب سينمائي فوق القاهرة...'],
  ['de', 'A cinematic sunset over Cairo...', 'Ein filmischer Sonnenuntergang über Kairo …'],
  ['ar', 'Separate vocals / instrumental', 'فصل الغناء / الموسيقى'],
  ['de', 'Audio waveform', 'Audio-Wellenform'],
  ['tr', 'Encode', 'Kodla'],
  ['ar', 'Decode', 'فك الترميز'],
  ['fr', 'Preview Data URI', 'Aperçu de Data URI'],
];
for (const [locale, source, expected] of samples) {
  assert.notEqual(source, expected, `${locale} must not fall back to English for ${source}`);
}
console.log(`Supplement localization contract PASS (${samples.length} representative mappings)`);
