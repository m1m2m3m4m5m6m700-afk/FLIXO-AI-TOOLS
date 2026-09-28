import { strict as assert } from 'node:assert';
import { assertPublicAgentBoundary, routeThroughFlixoAgent } from '../src/lib/agent/agent-gateway-policy.ts';
import { test } from 'node:test';
import { Readable } from 'node:stream';
import { Writable } from 'node:stream';

const edit = routeThroughFlixoAgent('remove the background and compress the image');
assert.equal(edit.publicAgent, 'FLIXO_AGENT');
assert.equal(edit.specialist, 'executionAgent');
assert.equal(edit.directSpecialistAccess, false);

const review = routeThroughFlixoAgent('audit this result for security');
assert.equal(review.publicAgent, 'FLIXO_AGENT');
assert.equal(review.specialist, 'reviewAgent');

const ordinary = routeThroughFlixoAgent('hello');
assert.equal(ordinary.publicAgent, 'FLIXO_AGENT');
assert.equal(ordinary.specialist, null);

assert.doesNotThrow(() => assertPublicAgentBoundary('FLIXO_AGENT'));
assert.throws(() => assertPublicAgentBoundary('reviewAgent'), /DIRECT_SPECIALIST_ACCESS_DENIED/);


test('public agent response does not expose internal specialist identity', async () => {
  const { default: handler } = await import('../api/flixo-agent.ts');

  const req = Readable.from([
    JSON.stringify({
      locale: 'en',
      messages: [{ role: 'user', content: 'compress my image' }],
    }),
  ]) as unknown as import('node:http').IncomingMessage;

  req.method = 'POST';
  req.headers = { 'content-type': 'application/json' };

  const chunks: Buffer[] = [];
  const res = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  }) as unknown as import('node:http').ServerResponse;
  res.statusCode = 200;
  res.setHeader = ((name: string, value: unknown) => {
    void name;
    void value;
    return res;
  }) as import('node:http').ServerResponse['setHeader'];

  res.end = ((chunk?: unknown) => {
    if (chunk !== undefined) chunks.push(Buffer.from(String(chunk)));
    return res;
  }) as import('node:http').ServerResponse['end'];

  await handler(req, res);

  const payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
  assert.equal(payload.internalSpecialist, undefined);
  assert.equal(payload.specialist, undefined);
  assert.equal(payload.agentId, undefined);
  assert.equal(payload.publicAgent, undefined);
  assert.equal(payload.taskId !== undefined, true);
});
