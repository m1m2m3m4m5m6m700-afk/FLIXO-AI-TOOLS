import { z } from "zod";

export const LayerTypeSchema = z.enum(["image", "video", "text", "audio"]);
export type LayerType = z.infer<typeof LayerTypeSchema>;

export const TransformSchema = z
  .object({
    x: z.number().finite().default(0),
    y: z.number().finite().default(0),
    scaleX: z.number().finite().positive().default(1),
    scaleY: z.number().finite().positive().default(1),
    rotation: z.number().finite().default(0),
    zIndex: z.number().int().default(0),
  })
  .strict();
export type Transform = z.infer<typeof TransformSchema>;

export const MediaTimeframeSchema = z
  .object({
    startTimeSec: z.number().finite().min(0).default(0),
    endTimeSec: z.number().finite().min(0),
    trimStartSec: z.number().finite().min(0).default(0),
    trimEndSec: z.number().finite().min(0).default(0),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.endTimeSec < data.startTimeSec) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endTimeSec must be greater than or equal to startTimeSec",
        path: ["endTimeSec"],
      });
    }
    if (data.trimEndSec < data.trimStartSec) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "trimEndSec must be greater than or equal to trimStartSec",
        path: ["trimEndSec"],
      });
    }
  });
export type MediaTimeframe = z.infer<typeof MediaTimeframeSchema>;

export const LayerSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(256),
    type: LayerTypeSchema,
    url: z.string().url().optional(),
    content: z.string().max(100_000).optional(),
    visible: z.boolean().default(true),
    locked: z.boolean().default(false),
    opacity: z.number().finite().min(0).max(1).default(1),
    transform: TransformSchema.default({}),
    timeframe: MediaTimeframeSchema.optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export type Layer = z.infer<typeof LayerSchema>;

export const TimelineEventSchema = z
  .object({
    id: z.string().uuid(),
    timestamp: z.number().finite().nonnegative(),
    actionType: z.string().min(1).max(128),
    affectedLayerId: z.string().uuid().optional(),
    description: z.string().min(1).max(4_000),
    snapshotState: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

export const CanvasDimensionsSchema = z
  .object({
    width: z.number().int().positive().max(32_768).default(1920),
    height: z.number().int().positive().max(32_768).default(1080),
    fps: z.number().int().positive().max(240).default(30),
  })
  .strict();
export type CanvasDimensions = z.infer<typeof CanvasDimensionsSchema>;

export const ProjectStateSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().min(1).max(512).default("Untitled Project"),
    dimensions: CanvasDimensionsSchema.default({}),
    durationSec: z.number().finite().nonnegative().max(86_400).default(0),
    layers: z.array(LayerSchema).max(10_000).default([]),
    timeline: z.array(TimelineEventSchema).max(100_000).default([]),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    version: z.number().int().positive().default(1),
  })
  .strict();
export type ProjectState = z.infer<typeof ProjectStateSchema>;
