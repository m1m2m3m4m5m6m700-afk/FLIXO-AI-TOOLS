import type { IncomingMessage, ServerResponse } from 'node:http';
import { acceptAgentEvent, verifyEventGatewaySecret } from '../src/lib/agent/event-gateway.ts';
import { parseAgentEvent } from '../src/lib/agent/event-envelope.ts';

const MAX_EVENT_BODY_BYTES = 256 * 1024;

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let raw = '';
  let bytes = 0;
  for await (const chunk of req) {
    const value = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    bytes += Buffer.byteLength(value);
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
  if (!verifyEventGatewaySecret(req.headers['x-flixo-event-secret'] as string | undefined)) {
    json(res, 401, { error: 'Unauthorized event gateway request.' });
    return;
  }
  try {
    const event = parseAgentEvent(await readJson(req));
    const result = await acceptAgentEvent(event);
    json(res, 202, {
      accepted: result.accepted,
      duplicate: result.duplicate,
      eventId: result.event.eventId,
      idempotencyKey: result.event.idempotencyKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid event.';
    json(res, message === 'EVENT_TOO_LARGE' ? 413 : 400, {
      error: message === 'EVENT_TOO_LARGE' ? 'Event payload too large.' : 'Invalid FLIXO event.',
    });
  }
}
