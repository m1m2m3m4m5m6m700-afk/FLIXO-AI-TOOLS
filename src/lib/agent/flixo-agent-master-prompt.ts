/**
 * FLIXO customer runtime adapter.
 *
 * The canonical prompt source is docs/agents/PROMPT-UNIFIED-EXECUTION.md.
 * This file contains only the dynamic runtime context adapter; it is not a
 * second instruction source.
 */
import canonicalPrompt from '../../../docs/agents/PROMPT-UNIFIED-EXECUTION.md?raw';

export const FLIXO_AGENT_PROMPT_ID = 'RPR-UNIFIED-EXECUTION-001';
export const FLIXO_AGENT_PROMPT_VERSION = 2;
export const FLIXO_AGENT_RUNTIME_ALIAS = 'FLIXO-IMAGE-AGENT-MASTER-001';

export type FlixoAgentPromptContext = Readonly<{
  locale: string;
  file: { name?: string; type?: string; size?: number } | null;
  activeCommand?: string | null;
  activePlan?: unknown;
  catalog: readonly Record<string, unknown>[];
  catalogFingerprint: string;
}>;

export function buildFlixoAgentMasterPrompt(context: FlixoAgentPromptContext): string {
  return [
    canonicalPrompt.trim(),
    '',
    '## CURRENT EXECUTION CONTEXT',
    'OPERATING_MODE=CUSTOMER_IMAGE_RUNTIME',
    `RUNTIME_PROMPT_ALIAS=${FLIXO_AGENT_RUNTIME_ALIAS}`,
    `LOCALE=${context.locale}`,
    `FILE=${JSON.stringify(context.file)}`,
    `ACTIVE_COMMAND=${JSON.stringify(context.activeCommand ?? null)}`,
    `ACTIVE_PLAN=${JSON.stringify(context.activePlan ?? null)}`,
    `CANONICAL_CATALOG_FINGERPRINT=${context.catalogFingerprint}`,
    `EXECUTABLE_CAPABILITIES=${JSON.stringify(context.catalog)}`,
  ].join('\n');
}
