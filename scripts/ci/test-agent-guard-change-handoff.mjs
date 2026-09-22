#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const session = read('scripts/ci/agent-session.mjs');
const guard = read('scripts/ci/guard-communication.mjs');
const handoff = read('docs/AGENT-HANDOFF-REPORT-SCHEMA.md');
const protocol = read('scripts/ci/repair-protocol.mjs');
const registry = read('scripts/ci/control-plane-registry.mjs');
const pkg = JSON.parse(read('package.json'));

assert.match(session, /from '\.\/guard-communication\.mjs'/u);
assert.match(session, /const guardChangeReport = createChangeReport/u);
assert.match(session, /record\.guardChangeReport = guardChangeReport/u);
assert.match(session, /guardChangeReport,/u);
assert.match(guard, /FLIXO-GUARD-CHANGE-REPORT-v1/u);
assert.match(guard, /recipient !== GUARD_ID/u);
assert.match(guard, /publicationAuthority: 'CHAIR_1'/u);
assert.match(guard, /greenGranted: false/u);
assert.match(guard, /ACCEPTED_FOR_CHAIR1|NEEDS_MORE_EVIDENCE|REJECTED/u);
assert.match(handoff, /## Guard Change Report/u);
assert.match(handoff, /guardChangeReport/u);
assert.match(protocol, /'scripts\/ci\/guard-communication\.mjs'/u);
assert.match(registry, /'scripts\/ci\/guard-communication\.mjs'/u);
assert.equal(typeof pkg.scripts['test:guard-communication'], 'string');
assert.match(pkg.scripts['test:unit'], /test:guard-communication/u);

console.log('AGENT_GUARD_CHANGE_HANDOFF=PASS');
console.log('GUARD_CHANGE_REPORT_BINDING=PASS');
console.log('GUARD_CHANGE_PUBLICATION_SEPARATION=PASS');
console.log('GUARD_CHANGE_HANDOFF_SCHEMA=PASS');
