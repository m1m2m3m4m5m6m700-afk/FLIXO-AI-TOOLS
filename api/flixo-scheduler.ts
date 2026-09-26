import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createAgentEvent } from '../src/lib/agent/event-gateway.ts';
import { claimDueSchedules, markScheduleRun } from '../src/server/agent/schedule-persistence.ts';

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

function authorized(req: IncomingMessage): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.authorization;
  return auth === \`Bearer \${secret}\`;
}

function agentUrl(): string {
  const explicit = process.env.FLIXO_INTERNAL_AGENT_URL?.trim();
  if (explicit) return explicit;
  const deployment = process.env.VERCEL_URL?.trim();
  if (deployment) return \`https://\${deployment}/api/flixo-agent\`;
  const site = process.env.VITE_SITE_URL?.trim();
  if (site) return new URL('/api/flixo-agent', site).toString();
  throw new Error('FLIXO_INTERNAL_AGENT_URL_NOT_CONFIGURED');
}

async function invokeAgent(input: Readonly<{
  ownerId: string;
  conversationId: string | null;
  locale: string;
  prompt: string;
  idempotencyKey: string;
}>): Promise<Response> {
  return fetch(agentUrl(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-flixo-scheduled-run': '1',
    },
    body: JSON.stringify({
      userId: input.ownerId,
      conversationId: input.conversationId,
      locale: input.locale,
      messages: [{ role: 'user', content: input.prompt }],
      idempotencyKey: input.idempotencyKey,
    }),
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    json(res, 405, { error: 'Method not allowed.' });
    return;
  }
  if (!authorized(req)) {
    json(res, 401, { error: 'Unauthorized.' });
    return;
  }

  try {
    const now = new Date().toISOString();
    const jobs = await claimDueSchedules(16, now);
    const results: Array<Record<string, unknown>> = [];

    for (const job of jobs) {
      const runEvent = createAgentEvent({
        source: 'SCHEDULE',
        eventType: 'scheduled.run',
        idempotencyKey: \`schedule:\${job.scheduleId}:\${job.runCount + 1}\`,
        userId: job.ownerId,
        conversationId: job.conversationId,
        payload: {
          scheduleId: job.scheduleId,
          runNumber: job.runCount + 1,
        },
      });

      try {
        const response = await invokeAgent({
          ownerId: job.ownerId,
          conversationId: job.conversationId,
          locale: job.locale,
          prompt: job.prompt,
          idempotencyKey: runEvent.idempotencyKey,
        });
        const bodyText = await response.text();
        const updated = response.ok
          ? await markScheduleRun(job, now, runEvent.eventId)
          : null;
        results.push({
          scheduleId: job.scheduleId,
          runEventId: runEvent.eventId,
          status: response.status,
          accepted: response.ok,
          active: updated?.active ?? job.active,
          providerResponseBytes: Buffer.byteLength(bodyText, 'utf8'),
        });
      } catch (error) {
        results.push({
          scheduleId: job.scheduleId,
          runEventId: runEvent.eventId,
          accepted: false,
          error: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
        });
      }
    }

    json(res, 200, {
      ok: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('[flixo-scheduler]', error instanceof Error ? error.name : 'unknown');
    json(res, 503, { error: 'Scheduler unavailable.' });
  }
}
