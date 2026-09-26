import { z } from "zod";

const IsoDateSchema = z.string().datetime({ offset: true });

export const DimensionsSchema = z
  .object({
    width: z.number().int().positive().max(32_768),
    height: z.number().int().positive().max(32_768),
    fps: z.number().finite().positive().max(240),
  })
  .strict();

export const LayerTransformSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    scaleX: z.number().finite().positive(),
    scaleY: z.number().finite().positive(),
    rotation: z.number().finite(),
    zIndex: z.number().int(),
  })
  .strict();

export const LayerSchema = z
  .object({
    id: z.string().min(1).max(256),
    name: z.string().min(1).max(256),
    type: z.enum(["image", "video", "audio", "text", "shape"]),
    url: z.string().url().optional(),
    visible: z.boolean(),
    locked: z.boolean(),
    opacity: z.number().finite().min(0).max(1),
    transform: LayerTransformSchema,
    metadata: z.record(z.string(), z.unknown()),
  })
  .strict();

export type Layer = z.infer<typeof LayerSchema>;

export const TimelineEventSchema = z
  .object({
    id: z.string().min(1).max(256),
    timestamp: z.number().finite().nonnegative(),
    actionType: z.string().min(1).max(128),
    affectedLayerId: z.string().min(1).max(256).optional(),
    description: z.string().min(1).max(4_000),
    snapshotState: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

export const ProjectStateSchema = z
  .object({
    id: z.string().min(1).max(256),
    title: z.string().min(1).max(512),
    dimensions: DimensionsSchema,
    durationSec: z.number().finite().nonnegative().max(86_400),
    layers: z.array(LayerSchema).max(10_000),
    timeline: z.array(TimelineEventSchema).max(100_000),
    createdAt: IsoDateSchema,
    updatedAt: IsoDateSchema,
    version: z.number().int().positive(),
  })
  .strict();

export type ProjectState = z.infer<typeof ProjectStateSchema>;