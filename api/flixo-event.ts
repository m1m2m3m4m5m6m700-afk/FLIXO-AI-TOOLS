import type { IncomingMessage, ServerResponse } from 'node:http';
import { assertAgentEvent, createAgentEvent } from '../src/lib/agent/event-gateway.ts';
import { appendAgentTaskEvent, isDurableAgentTaskStoreConfigured } from '../src/server/agent/durable-task-store.ts';

const MAX_EVENT_BODY_BYTES = 256 * 1024;

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

function hasValidSecret(value: string | string[] | undefined): boolean {
  const expected = process.env.FLIXO_EVENT_GATEWAY_SECRET?.trim();
  const provided = Array.isArray(value) ? value[0] : value;
  return Boolean(expected && provided && provided.trim() === expected);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let raw = '';
  let bytes = 0;
  for await (const chunk of req) {
    const value = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    bytes += Buffer.byteLength(value, 'utf8');
    if (bytes > MAX_EVENT_BODY_BYTES) throw new Error('EVENT_TOO_LARGE');
    raw += value;
  }
  return JSON.parse(raw);
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    json(res, 405, { error: 'Method not allowed.' });
    return;
  }

  if (!hasValidSecret(req.headers['x-flixo-event-secret'])) {
    json(res, 401, { error: 'Unauthorized event gateway request.' });
    return;
  }

  if (!isDurableAgentTaskStoreConfigured()) {
    json(res, 503, { error: 'Durable event gateway is not configured.' });
    return;
  }

  try {
    const raw = await readJson(req);
    assertAgentEvent(raw as never);
    const event = createAgentEvent(raw as never);
    const persisted = await appendAgentTaskEvent(event);
    json(res, persisted ? 202 : 200, {
      accepted: true,
      duplicate: persisted === null,
      eventId: event.eventId,
      idempotencyKey: event.idempotencyKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid FLIXO event.';
    json(res, message === 'EVENT_TOO_LARGE' ? 413 : 400, {
      error: message === 'EVENT_TOO_LARGE' ? 'Event payload too large.' : 'Invalid FLIXO event.',
    });
  }
}
