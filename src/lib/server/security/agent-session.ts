import { createHash, randomUUID } from 'node:crypto';

export const AGENT_SESSION_COOKIE = 'flixo_agent_session';
const SESSION_PATTERN = /^[A-Za-z0-9-]{36}$/u;

export type AgentSessionIdentity = Readonly<{
  sessionId: string;
  conversationId: string;
  taskId: string;
  idempotencyKey: string;
}>;

export function parseAgentSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name !== AGENT_SESSION_COOKIE) continue;
    const value = decodeURIComponent(rest.join('=')).trim();
    return SESSION_PATTERN.test(value) ? value : null;
  }
  return null;
}

export function createAgentSessionId(): string {
  return randomUUID();
}

function derive(sessionId: string, kind: string, clientValue: string): string {
  return 'ANON-' + kind + ':' + createHash('sha256')
    .update(sessionId + ':' + kind + ':' + clientValue, 'utf8')
    .digest('hex');
}

export function deriveAgentSessionIdentity(input: Readonly<{
  sessionId: string;
  conversationId?: string;
  taskId?: string | null;
  idempotencyKey?: string;
  messageCount: number;
}>): AgentSessionIdentity {
  if (!SESSION_PATTERN.test(input.sessionId)) throw new Error('AGENT_SESSION_ID_INVALID');
  const conversationId = derive(
    input.sessionId,
    'conversation',
    input.conversationId?.trim() || 'default',
  );
  const taskId = derive(
    input.sessionId,
    'task',
    input.taskId?.trim() || randomUUID(),
  );
  const idempotencyKey = derive(
    input.sessionId,
    'event',
    input.idempotencyKey?.trim() || 'chat:' + input.messageCount,
  );
  return Object.freeze({ sessionId: input.sessionId, conversationId, taskId, idempotencyKey });
}
