import { getToolConfig } from '../config/tools';

export type ProcessingMode = 'local' | 'remote';

const REMOTE_TOOL_IDS = new Set(['ai-image-generator']);

export function getToolProcessingMode(toolId: string): ProcessingMode {
  return REMOTE_TOOL_IDS.has(toolId) ? 'remote' : 'local';
}

export function getToolPrivacyCopy(toolId: string, locale: string): {
  label: string;
  detail: string;
  mode: ProcessingMode;
} {
  const mode = getToolProcessingMode(toolId);
  const tool = getToolConfig(toolId);
  const title = tool?.title ?? toolId;

  if (locale === 'ar') {
    return mode === 'local'
      ? { mode, label: 'معالجة محلية', detail: `تتم معالجة الملفات والمدخلات لأداة ${title} داخل متصفحك عندما تسمح طبيعة الأداة بذلك.`, }
      : { mode, label: 'معالجة خارجية', detail: `تستخدم أداة ${title} نقطة معالجة خارجية. لا تُعرض كأداة معالجة محلية.`, };
  }

  return mode === 'local'
    ? { mode, label: 'Local processing', detail: `Inputs for ${title} are processed in your browser when supported by the tool.`, }
    : { mode, label: 'External processing', detail: `${title} uses a configured external processing endpoint and is not presented as local-only.`, };
}
