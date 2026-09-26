import { z } from 'zod';

export const VideoTaskOperationSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum([
    'PROBE',
    'TRIM',
    'CROP',
    'RESIZE',
    'COMPRESS',
    'EXTRACT_AUDIO',
    'SUBTITLES',
    'CAPTION_BURN_IN',
    'BACKGROUND_BLUR',
    'OBJECT_TRACK',
    'OBJECT_REMOVE',
    'BACKGROUND_REPLACE',
    'ENHANCE',
  ]),
  purpose: z.string().min(1).max(500),
  order: z.number().int().positive(),
}).strict();

export const VideoTaskSpecSchema = z.object({
  version: z.literal(1),
  source: z.literal('DETERMINISTIC'),
  goal: z.string().min(1).max(2000),
  operations: z.array(VideoTaskOperationSchema).min(1).max(12),
  constraints: z.array(z.string().min(1).max(300)).max(24),
  execution: z.object({
    previewFirst: z.boolean(),
    longRunningJob: z.boolean(),
    requiresCloudModel: z.boolean(),
  }).strict(),
}).strict();

export type VideoTaskSpec = Readonly<z.infer<typeof VideoTaskSpecSchema>>;

const detect = (input: string, patterns: readonly RegExp[]): boolean =>
  patterns.some((pattern) => pattern.test(input));

export function compileVideoTaskSpec(input: string): VideoTaskSpec | null {
  const goal = input.trim();
  if (!goal) return null;

  const operations: Array<z.infer<typeof VideoTaskOperationSchema>> = [{
    id: 'step-1',
    kind: 'PROBE',
    purpose: 'inspect media duration, dimensions, codecs, frame rate, and audio tracks',
    order: 1,
  }];

  const add = (kind: z.infer<typeof VideoTaskOperationSchema>['kind'], purpose: string) => {
    operations.push({
      id: `step-${operations.length + 1}`,
      kind,
      purpose,
      order: operations.length + 1,
    });
  };

  if (detect(goal, [/\btrim\b|\bcut\b|قص|اقت(?:ص|طع)/iu])) add('TRIM', 'trim the requested time range');
  if (detect(goal, [/\bcrop\b|قص(?:\s+الفيديو)?\s+من/iu])) add('CROP', 'crop the requested frame region or aspect ratio');
  if (detect(goal, [/\bresize\b|\b4k\b|1080p|720p|تغيير الحجم|تغيير الدقة/iu])) add('RESIZE', 'resize the video to the requested output geometry');
  if (detect(goal, [/\bcompress\b|ضغط الفيديو|تصغير الحجم/iu])) add('COMPRESS', 'compress the video while respecting output quality constraints');
  if (detect(goal, [/\bsubtitle|captions?\b|ترجمه|ترجمة|ترجمات/iu])) add('SUBTITLES', 'generate or apply subtitles');
  if (detect(goal, [/\bburn.?in\b|حرق الترجمة|إظهار الترجمة/iu])) add('CAPTION_BURN_IN', 'burn captions into the rendered video');
  if (detect(goal, [/\bblur(?:\s+the)?\s+background\b|طمس الخلفية|ضبابية الخلفية/iu])) add('BACKGROUND_BLUR', 'blur the background while preserving the tracked subject');
  if (detect(goal, [/\btrack\b|تتبع|تتبّع/iu])) add('OBJECT_TRACK', 'track the requested subject or object over time');
  if (detect(goal, [/\bremove(?:\s+the)?\s+object\b|إزالة عنصر|حذف عنصر/iu])) add('OBJECT_REMOVE', 'remove the requested object with temporal consistency');
  if (detect(goal, [/\breplace background\b|تغيير الخلفية|استبدال الخلفية/iu])) add('BACKGROUND_REPLACE', 'replace the background consistently across frames');
  if (detect(goal, [/\benhance\b|تحسين الجودة|رفع الجودة/iu])) add('ENHANCE', 'enhance the video while preserving temporal consistency');

  const cloud = operations.some((operation) =>
    ['OBJECT_REMOVE', 'BACKGROUND_REPLACE', 'ENHANCE', 'SUBTITLES'].includes(operation.kind),
  );

  return parseVideoTaskSpec({
    version: 1,
    source: 'DETERMINISTIC',
    goal,
    operations,
    constraints: [
      'Preserve temporal continuity between adjacent frames.',
      'Do not mutate the original asset.',
      'Verify the rendered artifact before export.',
    ],
    execution: {
      previewFirst: true,
      longRunningJob: true,
      requiresCloudModel: cloud,
    },
  });
}

export function parseVideoTaskSpec(value: unknown): VideoTaskSpec {
  return Object.freeze(VideoTaskSpecSchema.parse(value));
}
