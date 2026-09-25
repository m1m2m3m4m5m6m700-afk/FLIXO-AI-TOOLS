export type ConversationEventKind =
  | 'USER_MESSAGE'
  | 'AGENT_MESSAGE'
  | 'TASK_STATE'
  | 'PLAN_READY'
  | 'EXECUTION_STARTED'
  | 'EXECUTION_FINISHED'
  | 'EXECUTION_FAILED'
  | 'CANCELLED'
  | 'SYSTEM';

export type ConversationEvent = Readonly<{
  version: 1;
  sequence: number;
  eventId: string;
  timestamp: string;
  kind: ConversationEventKind;
  payload: Readonly<Record<string, unknown>>;
  previousHash: string | null;
  hash: string;
}>;

const STORAGE_KEY = 'flixo-agent-event-store-v1';
const MAX_EVENTS = 500;

async function digest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const buffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function loadConversationEvents(): readonly ConversationEvent[] {
  if (!canUseStorage()) return Object.freeze([]);
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return Object.freeze([]);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return Object.freeze([]);
    return Object.freeze(parsed.filter((event): event is ConversationEvent =>
      Boolean(event)
      && (event as ConversationEvent).version === 1
      && Number.isInteger((event as ConversationEvent).sequence)
      && typeof (event as ConversationEvent).eventId === 'string'
      && typeof (event as ConversationEvent).hash === 'string',
    ).slice(-MAX_EVENTS));
  } catch {
    return Object.freeze([]);
  }
}

export async function appendConversationEvent(
  kind: ConversationEventKind,
  payload: Readonly<Record<string, unknown>>,
): Promise<ConversationEvent> {
  const current = loadConversationEvents();
  const previous = current.at(-1);
  const base = {
    version: 1 as const,
    sequence: (previous?.sequence ?? 0) + 1,
    eventId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    kind,
    payload,
    previousHash: previous?.hash ?? null,
  };
  const event = Object.freeze({ ...base, hash: await digest(base) });

  if (canUseStorage()) {
    try {
      const next = [...current, event].slice(-MAX_EVENTS);
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Conversation persistence must never block user interaction.
    }
  }

  return event;
}

export function verifyConversationEventChain(events: readonly ConversationEvent[] = loadConversationEvents()): boolean {
  if (events.length === 0) return true;
  let previousHash: string | null = events[0].previousHash;
  let previousSequence = events[0].sequence - 1;
  for (const event of events) {
    if (event.version !== 1) return false;
    if (!Number.isInteger(event.sequence) || event.sequence !== previousSequence + 1) return false;
    if (event.previousHash !== previousHash) return false;
    if (!event.hash || !event.eventId || !event.timestamp) return false;
    previousHash = event.hash;
    previousSequence = event.sequence;
  }
  return true;
}
