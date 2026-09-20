import { readFileSync } from 'node:fs';

const router = JSON.parse(readFileSync('docs/agents/ERROR-TEACHING-ROUTER.json', 'utf8'));
const query = process.argv.slice(2).join(' ').trim();
if (!query) {
  console.error('ERROR_TEACHING_ROUTE_ERROR=missing_query');
  process.exit(1);
}
const normalized = query.toLowerCase().replace(/[_/.:#-]+/gu, ' ').replace(/\s+/gu, ' ').trim();
const clean = (value) => value.toLowerCase().replace(/[_/.:#-]+/gu, ' ').replace(/\s+/gu, ' ').trim();

function result(group, by, term, confidence) {
  const sourceFiles = [group.file, ...(router.corpus?.expanded ?? [])];
  const text = sourceFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
  const rules = text.split(/\r?\n/u)
    .filter((line) => /^T\d{3,4} \|/u.test(line))
    .filter((line) => {
      const cls = line.match(/\| class=([^|]+)/u)?.[1]?.trim().toLowerCase();
      return cls === clean(term);
    })
    .map((line) => line.match(/^(T\d{3,4}) \|/u)?.[1])
    .filter(Boolean);
  return { query, route: group.file, matchedBy: by, matchedTerm: term, confidence, ruleIds: rules, next: 'read the routed file, then validate with current exact-SHA evidence and Error Memory' };
}

for (const group of router.groups) {
  if (group.classes.some((c) => clean(c) === normalized)) {
    process.stdout.write(JSON.stringify(result(group, 'exact_class', normalized, 1)));
    process.exit(0);
  }
}
for (const group of router.groups) {
  const found = group.classes.find((c) => normalized.startsWith(clean(c)));
  if (found) {
    process.stdout.write(JSON.stringify(result(group, 'class_prefix', found, 0.95)));
    process.exit(0);
  }
}
for (const [alias, file] of Object.entries(router.aliases)) {
  if (normalized === clean(alias) || normalized.includes(clean(alias))) {
    const group = router.groups.find((item) => item.file === file);
    process.stdout.write(JSON.stringify(result(group, 'alias', alias, 0.9)));
    process.exit(0);
  }
}
for (const group of router.groups) {
  const terms = group.prefixes.map(clean);
  const hit = terms.find((term) => normalized.includes(term));
  if (hit) {
    process.stdout.write(JSON.stringify(result(group, 'keyword', hit, 0.8)));
    process.exit(0);
  }
}
console.error('ERROR_TEACHING_ROUTE_ERROR=ambiguous_or_unmapped_query');
process.exit(2);
