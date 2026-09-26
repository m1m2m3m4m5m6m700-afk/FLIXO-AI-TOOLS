import { z } from "zod";

export const LayerTypeSchema = z.enum(["image", "video", "text", "audio"]);
export type LayerType = z.infer<typeof LayerTypeSchema>;

export const TransformSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  scaleX: z.number().default(1),
  scaleY: z.number().default(1),
  rotation: z.number().default(0),
  zIndex: z.number().int().default(0),
});
export type Transform = z.infer<typeof TransformSchema>;

export const MediaTimeframeSchema = z
  .object({
    startTimeSec: z.number().min(0).default(0),
    endTimeSec: z.number().min(0),
    trimStartSec: z.number().min(0).default(0),
    trimEndSec: z.number().min(0).default(0),
  })
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

export const LayerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  type: LayerTypeSchema,
  url: z.string().url().optional(),
  content: z.string().optional(),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  opacity: z.number().min(0).max(1).default(1),
  transform: TransformSchema.default({}),
  timeframe: MediaTimeframeSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type Layer = z.infer<typeof LayerSchema>;

export const TimelineEventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.number().min(0),
  actionType: z.string().min(1),
  affectedLayerId: z.string().uuid().optional(),
  description: z.string().min(1),
  snapshotState: z.record(z.string(), z.unknown()).optional(),
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

export const CanvasDimensionsSchema = z.object({
  width: z.number().int().positive().default(1920),
  height: z.number().int().positive().default(1080),
  fps: z.number().int().positive().default(30),
});
export type CanvasDimensions = z.infer<typeof CanvasDimensionsSchema>;

export const ProjectStateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).default("Untitled Project"),
  dimensions: CanvasDimensionsSchema.default({}),
  durationSec: z.number().min(0).default(0),
  layers: z.array(LayerSchema).default([]),
  timeline: z.array(TimelineEventSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.number().int().positive().default(1),
});
export type ProjectState = z.infer<typeof ProjectStateSchema>;
