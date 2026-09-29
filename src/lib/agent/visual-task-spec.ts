import type { ExecutionPlanContract } from '@/lib/contracts/ai-plan';
import { parseVisualTaskSpec, type VisualTaskSpec } from '@/lib/contracts/visual-task-spec';

const PRESERVE_PATTERNS: readonly [RegExp, string, 'CRITICAL' | 'HIGH' | 'NORMAL'][] = [
  [/\b(?:do not|don't|dont|preserve|keep) (?:the )?(?:face|identity)\b/iu, 'preserve identity and facial features', 'CRITICAL'],
  [/(?:لا\s*(?:تغيّر|تغير|تعدل)|حافظ على)\s*(?:الوجه|ملامح|الهويه|الهوية)/iu, 'preserve identity and facial features', 'CRITICAL'],
  [/\b(?:do not|don't|dont|preserve|keep) (?:the )?(?:subject|product|person)\b/iu, 'preserve the primary subject', 'HIGH'],
  [/(?:لا\s*(?:تغيّر|تغير|تعدل)|حافظ على)\s*(?:الشخص|العنصر|المنتج)/iu, 'preserve the primary subject', 'HIGH'],
];

const STYLE_PATTERNS: readonly [RegExp, string][] = [
  [/\bcinematic\b|سينمائي/iu, 'cinematic visual treatment'],
  [/\bnatural\b|طبيعي(?:ه|ة)?/iu, 'natural visual treatment'],
  [/\bprofessional\b|احترافي/iu, 'professional visual treatment'],
  [/\badvertis(?:e|ing|ement)\b|اعلان|إعلان/iu, 'advertising-oriented visual treatment'],
];

const TOOL_PURPOSES: Readonly<Record<string, string>> = {
  'background-remover': 'remove or isolate the background',
  'object-remover': 'remove the requested object or selected region',
  'image-upscaler': 'increase image resolution',
  'image-cropper': 'crop or resize the image',
  'image-compressor': 'reduce output file size',
  'image-converter': 'convert the image format',
  'image-effects': 'apply deterministic visual adjustments',
};

function unique<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

export function compileVisualTaskSpec(input: string, plan: ExecutionPlanContract | null | undefined): VisualTaskSpec | null {
  const goal = input.trim();
  if (!goal || !plan) return null;

  const constraints = unique(
    [
      ...PRESERVE_PATTERNS.flatMap(([pattern, value, priority]) => pattern.test(goal) ? [{
        id: value.replaceAll(' ', '-'),
        kind: 'PRESERVE' as const,
        value,
        priority,
      }] : []),
      ...STYLE_PATTERNS.flatMap(([pattern, value]) => pattern.test(goal) ? [{
        id: value.replaceAll(' ', '-'),
        kind: 'STYLE' as const,
        value,
        priority: 'NORMAL' as const,
      }] : []),
    ],
    (item) => item.id,
  );

  const operations = plan.steps.map((step, index) => ({
    id: `step-${index + 1}`,
    capabilityId: step.toolId,
    purpose: TOOL_PURPOSES[step.toolId] ?? 'execute the registered FLIXO capability',
    order: index + 1,
  }));

  return parseVisualTaskSpec({
    version: 1,
    source: 'DETERMINISTIC',
    goal,
    constraints,
    operations,
    quality: {
      artifactTolerance: constraints.some((item) => item.priority === 'CRITICAL') ? 'LOW' : 'MEDIUM',
      preserveSubject: constraints.some((item) => item.kind === 'PRESERVE'),
      requireVisibleChange: plan.steps.some((step) => ['image-effects', 'background-remover', 'object-remover'].includes(step.toolId)),
    },
  });
}
