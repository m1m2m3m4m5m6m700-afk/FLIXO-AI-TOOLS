import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { createLLMToolParameters, zodToJsonSchema } from '../src/lib/agent/zod-json-schema.ts';

test('converts object fields and required keys', () => {
  const schema = z.object({
    prompt: z.string().min(1),
    quality: z.enum(['standard', 'high']).optional(),
    count: z.number().int().min(1).max(4),
  }).strict();

  assert.deepEqual(zodToJsonSchema(schema), {
    type: 'object',
    properties: {
      prompt: { type: 'string', minLength: 1 },
      quality: { type: 'string', enum: ['standard', 'high'] },
      count: { type: 'number', minimum: 1, maximum: 4, type: 'integer' },
    },
    required: ['prompt', 'count'],
    additionalProperties: false,
  });
});

test('converts arrays, unions, literals and nullable fields', () => {
  const schema = z.object({
    mode: z.union([z.literal('fast'), z.literal('quality')]),
    tags: z.array(z.string()),
    note: z.string().nullable(),
  });
  const json = zodToJsonSchema(schema);

  assert.deepEqual(json.properties, {
    mode: { anyOf: [{ const: 'fast' }, { const: 'quality' }] },
    tags: { type: 'array', items: { type: 'string' } },
    note: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  });
  assert.deepEqual(json.required, ['mode', 'tags', 'note']);
});

test('converts records and native enums without losing JSON shape', () => {
  enum Format { PNG = 'png', JPEG = 'jpeg' }
  const json = zodToJsonSchema(z.object({
    metadata: z.record(z.string()),
    format: z.nativeEnum(Format),
  }));

  assert.deepEqual(json.properties, {
    metadata: { type: 'object', additionalProperties: { type: 'string' } },
    format: { enum: ['png', 'jpeg'] },
  });
});

test('unwraps defaults and effects while preserving the underlying contract', () => {
  const schema = z.object({
    title: z.string().default('untitled'),
    slug: z.string().transform((value) => value.trim()),
  });
  const json = zodToJsonSchema(schema);

  assert.deepEqual(json.properties, {
    title: { type: 'string' },
    slug: { type: 'string' },
  });
  assert.deepEqual(json.required, ['slug']);
});

test('returns an empty schema for intentionally unconstrained JSON values', () => {
  assert.deepEqual(zodToJsonSchema(z.unknown()), {});
  assert.deepEqual(zodToJsonSchema(z.any()), {});
});

test('exposes the same converter for LLM tool parameters', () => {
  const parameters = createLLMToolParameters(z.object({ width: z.number().int().positive() }));
  assert.deepEqual(parameters, {
    type: 'object',
    properties: { width: { type: 'number', minimum: 0, type: 'integer' } },
    required: ['width'],
    additionalProperties: false,
  });
});