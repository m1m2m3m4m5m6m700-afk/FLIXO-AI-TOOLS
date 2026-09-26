import unifiedPrompt from '../../../docs/agents/PROMPT-UNIFIED-EXECUTION.md?raw';
import browserObservationSkill from '../../../docs/agent-skills/browser-observation.md?raw';
import reactPerformanceSkill from '../../../docs/agent-skills/react-performance.md?raw';
import frontendDesignSkill from '../../../docs/agent-skills/frontend-design.md?raw';

export const OPERATING_MODE = 'CUSTOMER_IMAGE_RUNTIME';

export const FLIXO_AGENT_MASTER_PROMPT = [
  unifiedPrompt.trim(),
  '',
  'ADVISORY_SKILLS',
  browserObservationSkill.trim(),
  '',
  reactPerformanceSkill.trim(),
  '',
  frontendDesignSkill.trim(),
  '',
  `OPERATING_MODE=${OPERATING_MODE}`,
].join('\n');

export function buildFlixoAgentPrompt(context: Record<string, unknown> = {}) {
  return [FLIXO_AGENT_MASTER_PROMPT, '', 'DYNAMIC_RUNTIME_CONTEXT', JSON.stringify(context, null, 2)].join('\n');
}

export default FLIXO_AGENT_MASTER_PROMPT;
