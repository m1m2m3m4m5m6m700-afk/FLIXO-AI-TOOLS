import { z } from 'zod';

export type JsonSchema = Record<string, unknown>;

function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    return unwrap(schema.unwrap());
  }
  if (schema instanceof z.ZodDefault) {
    return unwrap(schema._def.innerType);
  }
  if (schema instanceof z.ZodEffects) {
    return unwrap(schema.innerType());
  }
  return schema;
}

function checks(schema: z.ZodTypeAny): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  const raw = schema._def.checks as Array<Record<string, unknown>> | undefined;
  for (const check of raw ?? []) {
    if (check.kind === 'min') output.minimum = check.value;
    if (check.kind === 'max') output.maximum = check.value;
    if (check.kind === 'int') output.type = 'integer';
    if (check.kind === 'email') output.format = 'email';
    if (check.kind === 'url') output.format = 'uri';
  }
  return output;
}

export function zodToJsonSchema(schema: z.ZodTypeAny): JsonSchema {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) {
    return zodToJsonSchema(schema._def.innerType);
  }

  if (schema instanceof z.ZodNullable) {
    return { anyOf: [zodToJsonSchema(schema.unwrap()), { type: 'null' }] };
  }

  if (schema instanceof z.ZodEffects) {
    return zodToJsonSchema(schema.innerType());
  }

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const key of Object.keys(shape)) {
      const field = shape[key];
      properties[key] = zodToJsonSchema(field);
      if (!field.isOptional()) required.push(key);
    }

    const unknownKeys = schema._def.unknownKeys;
    return {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
      ...(unknownKeys === 'passthrough' ? {} : { additionalProperties: false }),
    };
  }

  if (schema instanceof z.ZodString) {
    return { type: 'string', ...checks(schema) };
  }

  if (schema instanceof z.ZodNumber) {
    return { type: 'number', ...checks(schema) };
  }

  if (schema instanceof z.ZodBigInt) {
    return { type: 'integer', ...checks(schema), description: 'JSON-safe integer value.' };
  }

  if (schema instanceof z.ZodBoolean) return { type: 'boolean' };

  if (schema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodToJsonSchema(schema.element),
      ...checks(schema),
    };
  }

  if (schema instanceof z.ZodEnum) {
    return { type: 'string', enum: schema.options };
  }

  if (schema instanceof z.ZodNativeEnum) {
    const values = Object.values(schema.enum).filter(
      (value): value is string | number => typeof value === 'string' || typeof value === 'number',
    );
    return { enum: [...new Set(values)] };
  }

  if (schema instanceof z.ZodLiteral) {
    return { const: schema.value };
  }

  if (schema instanceof z.ZodUnion) {
    return { anyOf: schema.options.map(zodToJsonSchema) };
  }

  if (schema instanceof z.ZodRecord) {
    return {
      type: 'object',
      additionalProperties: zodToJsonSchema(schema.valueSchema),
    };
  }

  if (schema instanceof z.ZodTuple) {
    return {
      type: 'array',
      prefixItems: schema.items.map(zodToJsonSchema),
      minItems: schema.items.length,
      maxItems: schema.items.length,
    };
  }

  if (schema instanceof z.ZodNull) return { type: 'null' };
  if (schema instanceof z.ZodAny || schema instanceof z.ZodUnknown) return {};
  if (schema instanceof z.ZodNever) return { not: {} };

  return { type: 'string' };
}

export function createLLMToolParameters(schema: z.ZodTypeAny): JsonSchema {
  return zodToJsonSchema(schema);
}