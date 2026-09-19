import type { Locale } from '@/lib/i18n';

export type ConversationTurn = Readonly<{
  role: 'user' | 'agent';
  text: string;
}>;

export type ConversationMemory = {
  version: 1;
  turns: ConversationTurn[];
  activeCommand: string | null;
  activeToolId: string | null;
  pendingToolId: string | null;
  pendingQuestion: string | null;
  lastPlanReady: boolean;
};

const MAX_MEMORY_TURNS = 80;
const STORAGE_KEY = 'flixo-agent-conversation-v1';

const normalize = (value: string): string =>
  value
    .trim()
    .toLocaleLowerCase()
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');

const hasAny = (text: string, patterns: readonly RegExp[]) => patterns.some((pattern) => pattern.test(text));

const CONTINUATION_PATTERNS: readonly RegExp[] = [
  /(?:^|\s)(?:و|ثم|وبعدين|بعدها|كمان|أيضا|ايضا|برضه|برضو|دلوقتي|الان|الآن)(?:\s|$)/i,
  /(?:هذا|هذه|ذلك|تلك|ها|عليه|عليها|منها|فيها|به|بها|نفسها|نفسه)/i,
  /^(?:مربع|مربعه|square|1[:/]1|\d{2,5}\s*[x×]\s*\d{2,5})$/i,
];

const GREETING_PATTERNS: readonly RegExp[] = [
  /^(?:مرحبا|مرحبًا|اهلا|أهلا|اهلين|السلام عليكم|السلامعليكم|هاي|هلا|hello|hi|hey|سلام)\b/i,
];

const THANKS_PATTERNS: readonly RegExp[] = [
  /^(?:شكرا|شكرًا|ممتاز|رائع|تمام|تسلم|يعطيك العافيه|يعطيك العافية|thanks|thank you|great|perfect|nice)\b/i,
];

const FAREWELL_PATTERNS: readonly RegExp[] = [
  /^(?:مع السلامه|مع السلامة|اشوفك|أشوفك|الى اللقاء|إلى اللقاء|باي|وداعا|وداعًا|bye|goodbye)\b/i,
];

const HELP_PATTERNS: readonly RegExp[] = [
  /(?:كيف|ازاي|إزاي|كيفاش|لماذا|ليش|ليه|what|how|why)\s+(?:تعمل|يعمل|تقدر|يمكنك|works?|do you|does it)/i,
  /(?:كيف تستخدم|ازاي استخدم|how to use|how does this work)/i,
];

const CONVERSATIONAL_PATTERNS: readonly RegExp[] = [
  /^(?:من انت|مين انت|من أنت|who are you)\??$/i,
  /^(?:ماذا تستطيع|ماذا تقدر|ايه اللي تقدر|ما الذي تستطيع|what can you do)\??$/i,
  /^(?:هل تفهمني|فاهمني|do you understand me)\??$/i,
];

export type ConversationKind = 'greeting' | 'thanks' | 'farewell' | 'capability' | 'help' | 'conversation' | 'continuation' | 'task';

export function createConversationMemory(): ConversationMemory {
  return {
    version: 1,
    turns: [],
    activeCommand: null,
    activeToolId: null,
    pendingToolId: null,
    pendingQuestion: null,
    lastPlanReady: false,
  };
}

export function loadConversationMemory(): ConversationMemory {
  if (typeof window === 'undefined') return createConversationMemory();
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return createConversationMemory();
    const parsed = JSON.parse(raw) as Partial<ConversationMemory>;
    if (parsed.version !== 1 || !Array.isArray(parsed.turns)) return createConversationMemory();
    return {
      version: 1,
      turns: parsed.turns.slice(-MAX_MEMORY_TURNS).filter((turn): turn is ConversationTurn =>
        Boolean(turn) &&
        (turn as ConversationTurn).role !== undefined &&
        typeof (turn as ConversationTurn).text === 'string',
      ),
      activeCommand: typeof parsed.activeCommand === 'string' ? parsed.activeCommand : null,
      activeToolId: typeof parsed.activeToolId === 'string' ? parsed.activeToolId : null,
      pendingToolId: typeof parsed.pendingToolId === 'string' ? parsed.pendingToolId : null,
      pendingQuestion: typeof parsed.pendingQuestion === 'string' ? parsed.pendingQuestion : null,
      lastPlanReady: parsed.lastPlanReady === true,
    };
  } catch {
    return createConversationMemory();
  }
}

export function saveConversationMemory(memory: ConversationMemory): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Session memory is best-effort and must never block the agent.
  }
}

export function rememberTurn(
  memory: ConversationMemory,
  turn: ConversationTurn,
): ConversationMemory {
  const next: ConversationMemory = {
    ...memory,
    turns: [...memory.turns, turn].slice(-MAX_MEMORY_TURNS),
  };
  saveConversationMemory(next);
  return next;
}

export function classifyConversation(text: string): ConversationKind {
  const normalized = normalize(text);
  if (!normalized) return 'conversation';
  if (hasAny(normalized, GREETING_PATTERNS)) return 'greeting';
  if (hasAny(normalized, THANKS_PATTERNS)) return 'thanks';
  if (hasAny(normalized, FAREWELL_PATTERNS)) return 'farewell';
  if (hasAny(normalized, CONVERSATIONAL_PATTERNS)) {
    if (/(?:ما|ماذا|ايه|ما الذي|what)\s+(?:تستطيع|تقدر|can you)/i.test(normalized)) return 'capability';
    return 'conversation';
  }
  if (hasAny(normalized, HELP_PATTERNS)) return 'help';
  if (hasAny(normalized, CONTINUATION_PATTERNS)) return 'continuation';
  return 'task';
}

export function isConversational(text: string): boolean {
  const kind = classifyConversation(text);
  return kind !== 'task' && kind !== 'continuation';
}

export function contextualizeCommand(text: string, memory: ConversationMemory): string {
  const current = text.trim();
  if (!current) return current;
  const kind = classifyConversation(current);
  if (kind !== 'continuation' || !memory.activeCommand) return current;

  if (memory.pendingToolId === 'image-cropper') {
    return `${memory.activeCommand} ${current}`;
  }

  return `${memory.activeCommand}. ${current}`;
}

export function setConversationTask(
  memory: ConversationMemory,
  task: {
    command: string;
    toolId?: string | null;
    pendingToolId?: string | null;
    pendingQuestion?: string | null;
    planReady: boolean;
  },
): ConversationMemory {
  const next: ConversationMemory = {
    ...memory,
    activeCommand: task.command,
    activeToolId: task.toolId ?? memory.activeToolId,
    pendingToolId: task.pendingToolId ?? null,
    pendingQuestion: task.pendingQuestion ?? null,
    lastPlanReady: task.planReady,
  };
  saveConversationMemory(next);
  return next;
}

export function clearConversationTask(memory: ConversationMemory): ConversationMemory {
  const next: ConversationMemory = {
    ...memory,
    activeCommand: null,
    activeToolId: null,
    pendingToolId: null,
    pendingQuestion: null,
    lastPlanReady: false,
  };
  saveConversationMemory(next);
  return next;
}

export function conversationalReply(kind: ConversationKind, locale: Locale): string | null {
  if (locale === 'ar') {
    switch (kind) {
      case 'greeting': return 'أهلاً 👋 أنا وكيل FLIXO. نستطيع أن نتحدث بشكل طبيعي، ويمكنني متابعة ما اتفقنا عليه عبر الرسائل المتتابعة ثم تحويل الجزء المطلوب إلى خطة تنفيذ عند الحاجة.';
      case 'thanks': return 'العفو 🌷 نكمل من حيث توقفنا.';
      case 'farewell': return 'إلى اللقاء 👋 سأحتفظ بسياق هذه الجلسة ما دامت الجلسة مفتوحة.';
      case 'capability': return 'أستطيع فهم الطلبات المتتابعة والحوار عنها، ثم عند الحاجة أستخرج من الحديث عمليات الصور المحلية المسموح بها مثل القص، تغيير الأبعاد، الضغط، تحويل الصيغة، إزالة الخلفية وتحسين الصورة.';
      case 'help': return 'تحدث معي بطريقتك المعتادة. يمكنك البدء بفكرة عامة، ثم إضافة تفاصيل في رسائل لاحقة مثل: «اجعلها مربعة»، «ثم حوّلها إلى WebP»، أو «لا، أريد الحجم أصغر». سأربط هذه الرسائل بالسياق السابق بدل بدء مهمة جديدة كل مرة.';
      case 'conversation': return 'نعم، أستطيع متابعة الحوار والسياق بدل التعامل مع كل رسالة كأمر منفصل. أخبرني بما تفكر فيه وسأبني على ما قلته قبلها.';
      default: return null;
    }
  }

  switch (kind) {
    case 'greeting': return 'Hello 👋 I am the FLIXO agent. You can talk naturally; I will keep the current conversation context and only turn it into an execution plan when needed.';
    case 'thanks': return 'You’re welcome. Let’s continue from where we left off.';
    case 'farewell': return 'Goodbye 👋 I will keep the session context while this session remains open.';
    case 'capability': return 'I can follow a multi-turn conversation, keep the current task context, and turn the relevant part into a safe local execution plan when needed.';
    case 'help': return 'Talk to me naturally. You can start with a broad goal and add details later, such as “make it square” or “then convert it to WebP”. I will connect those follow-ups to the current context.';
    case 'conversation': return 'Yes. I can follow the conversation and preserve context instead of treating every message as a separate command.';
    default: return null;
  }
}
