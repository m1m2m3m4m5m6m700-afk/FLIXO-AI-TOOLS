export type SurveyQuestionType = 'text' | 'textarea' | 'rating' | 'select' | 'multiselect' | 'boolean';

export type SurveyQuestion = {
  id: string;
  label: string;
  type: SurveyQuestionType;
  required: boolean;
  options?: string[];
};

export type Survey = {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'active' | 'archived';
  audience: 'all' | 'signed-in' | 'tool-users';
  createdAt: string;
  updatedAt: string;
  questions: SurveyQuestion[];
};

export type SurveyResponse = {
  id: string;
  surveyId: string;
  submittedAt: string;
  locale?: string;
  answers: Record<string, string | string[] | number | boolean | null>;
};

export type AdminAuditEvent = {
  id: string;
  action: string;
  target: string;
  at: string;
};

const SURVEYS_KEY = 'flixo.admin.surveys.v1';
const RESPONSES_KEY = 'flixo.admin.responses.v1';
const AUDIT_KEY = 'flixo.admin.audit.v1';

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

export const DEFAULT_SURVEYS: Survey[] = [
  {
    id: 'product-feedback', title: 'Product Feedback', description: 'Understand overall satisfaction and the most valuable parts of FLIXO.', status: 'active', audience: 'all', createdAt: now(), updatedAt: now(),
    questions: [
      { id: 'overall', label: 'How satisfied are you with FLIXO?', type: 'rating', required: true },
      { id: 'value', label: 'Which part of FLIXO is most valuable to you?', type: 'text', required: false },
      { id: 'improve', label: 'What should we improve next?', type: 'textarea', required: false },
    ],
  },
  {
    id: 'tool-feedback', title: 'Tool Feedback', description: 'Collect feedback after a user completes an image, PDF, audio, video, or text tool.', status: 'draft', audience: 'tool-users', createdAt: now(), updatedAt: now(),
    questions: [
      { id: 'tool-rating', label: 'How easy was this tool to use?', type: 'rating', required: true },
      { id: 'tool-job', label: 'What were you trying to accomplish?', type: 'text', required: true },
      { id: 'tool-friction', label: 'Where did you encounter friction?', type: 'textarea', required: false },
    ],
  },
  {
    id: 'feature-request', title: 'Feature Request', description: 'Capture prioritized requests for future FLIXO capabilities.', status: 'active', audience: 'all', createdAt: now(), updatedAt: now(),
    questions: [
      { id: 'feature', label: 'What feature would make FLIXO more useful?', type: 'textarea', required: true },
      { id: 'frequency', label: 'How often would you use it?', type: 'select', required: true, options: ['Daily', 'Weekly', 'Monthly', 'Occasionally'] },
    ],
  },
  {
    id: 'privacy-trust', title: 'Privacy & Trust', description: 'Measure whether privacy-first behavior is clear and trusted.', status: 'draft', audience: 'all', createdAt: now(), updatedAt: now(),
    questions: [
      { id: 'trust', label: 'Do you understand how your files are processed?', type: 'boolean', required: true },
      { id: 'privacy-reason', label: 'What makes you trust or distrust a browser tool?', type: 'textarea', required: false },
    ],
  },
  {
    id: 'ai-experience', title: 'AI Experience', description: 'Evaluate AI-assisted features while keeping feedback privacy-conscious.', status: 'draft', audience: 'tool-users', createdAt: now(), updatedAt: now(),
    questions: [
      { id: 'ai-use', label: 'Which AI capability did you use?', type: 'multiselect', required: false, options: ['Captioning', 'OCR', 'Voice', 'Intent search', 'QuickFlow'] },
      { id: 'ai-quality', label: 'How would you rate the AI result?', type: 'rating', required: true },
      { id: 'ai-notes', label: 'What should the AI do better?', type: 'textarea', required: false },
    ],
  },
];

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getSurveys(): Survey[] {
  return read(SURVEYS_KEY, DEFAULT_SURVEYS);
}

export function saveSurveys(surveys: Survey[]) {
  write(SURVEYS_KEY, surveys);
}

export function getResponses(): SurveyResponse[] {
  return read<SurveyResponse[]>(RESPONSES_KEY, []);
}

export function saveResponses(responses: SurveyResponse[]) {
  write(RESPONSES_KEY, responses);
}

export function getAuditEvents(): AdminAuditEvent[] {
  return read<AdminAuditEvent[]>(AUDIT_KEY, []);
}

export function audit(action: string, target: string) {
  const events = getAuditEvents();
  events.unshift({ id: id('audit'), action, target, at: now() });
  write(AUDIT_KEY, events.slice(0, 250));
}

export function createSurvey(title: string, description: string): Survey {
  const created = now();
  return {
    id: id('survey'), title: title.trim() || 'Untitled survey', description: description.trim(), status: 'draft', audience: 'all', createdAt: created, updatedAt: created,
    questions: [],
  };
}

export function createQuestion(label: string, type: SurveyQuestionType): SurveyQuestion {
  return { id: id('question'), label: label.trim() || 'Untitled question', type, required: false };
}

export function downloadResponsesCsv(surveyMap: Map<string, Survey>, responses: SurveyResponse[]) {
  const rows = responses.map((response) => {
    const survey = surveyMap.get(response.surveyId);
    const answers = Object.entries(response.answers).map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(' | ') : String(value ?? '')}`).join(' ; ');
    return [response.submittedAt, survey?.title ?? response.surveyId, response.locale ?? '', answers];
  });
  const csv = [['submittedAt', 'survey', 'locale', 'answers'], ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `flixo-survey-responses-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
