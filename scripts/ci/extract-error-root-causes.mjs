import { readFileSync, writeFileSync } from 'node:fs';

const sourcePath = process.argv[2] || 'docs/ERROR_MEMORY.md';
const outputPath = process.argv[3] || process.env.ERROR_ROOT_CAUSE_OUTPUT;

const source = readFileSync(sourcePath, 'utf8');
const indexMatch = source.match(/## Incident Index\n\n([\s\S]*?)\n\n---/);
if (!indexMatch) throw new Error('ERROR_MEMORY incident index is missing or malformed');

const rows = indexMatch[1]
  .split('\n')
  .filter((line) => line.startsWith('| F-'))
  .map((line) => {
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length !== 5) throw new Error(`Malformed incident index row: ${line}`);
    const [id, area, severity, status, rootCause] = cells;
    return { id, area, severity, status, rootCause };
  });

const sections = new Map();
for (const match of source.matchAll(/^## (F-\d+) — (.+)$/gm)) {
  const start = match.index + match[0].length;
  const next = source.slice(start).search(/^## F-\d+ — /m);
  const body = source.slice(start, next === -1 ? source.length : start + next).trim();
  sections.set(match[1], { title: match[2], body });
}

const requiredFields = ['Area:', 'Symptom:', 'Root cause:', 'Evidence:', 'Fix:', 'Prevention:'];
const incidents = rows.map((row) => {
  const section = sections.get(row.id);
  if (!section) throw new Error(`${row.id} exists in index but has no incident section`);

  const fields = {};
  for (const field of requiredFields) {
    const label = field.slice(0, -1);
    const pattern = new RegExp(`\\*\\*${label}\\*\\*:?\\s*([\\s\\S]*?)(?=\\n\\*\\*[A-Za-z][^*]*\\*\\*:|\\n## |$)`);
    const match = section.body.match(pattern);
    if (match) fields[label.toLowerCase().replaceAll(' ', '_')] = match[1].trim();
  }

  const rootCauseText = fields.root_cause || row.rootCause;
  const rootCauseKey = rootCauseText
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);

  return {
    id: row.id,
    title: section.title,
    area: row.area,
    severity: row.severity,
    status: row.status,
    rootCause: rootCauseText,
    rootCauseKey,
    symptom: fields.symptom || null,
    evidence: fields.evidence || null,
    fix: fields.fix || null,
    prevention: fields.prevention || null,
  };
});

const rootCauseGroups = new Map();
for (const incident of incidents) {
  const group = rootCauseGroups.get(incident.rootCauseKey) || [];
  group.push(incident.id);
  rootCauseGroups.set(incident.rootCauseKey, group);
}

const unresolved = incidents.filter((incident) => /pending|blocked|unknown|failed/i.test(incident.status));
const report = {
  schemaVersion: 1,
  source: sourcePath,
  generatedAt: new Date().toISOString(),
  incidentCount: incidents.length,
  unresolvedCount: unresolved.length,
  incidents,
  rootCauseGroups: [...rootCauseGroups.entries()].map(([rootCauseKey, incidentIds]) => ({ rootCauseKey, incidentIds })),
};

if (outputPath) writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
