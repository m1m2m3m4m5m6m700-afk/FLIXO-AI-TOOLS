import { z } from 'zod';

export const adminRoleSchema = z.enum(['owner', 'admin', 'analyst']);
export const surveyStatusSchema = z.enum(['draft', 'active', 'archived']);
export const surveyAudienceSchema = z.enum(['all', 'signed-in', 'tool-users']);
export const surveyQuestionTypeSchema = z.enum(['text', 'textarea', 'rating', 'select', 'multiselect', 'boolean']);

export const surveyIdSchema = z.string().uuid();
export const surveyCreateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).default(''),
  audience: surveyAudienceSchema.default('all'),
});

export const surveyUpdateSchema = z.object({
  id: surveyIdSchema,
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(1000).optional(),
  status: surveyStatusSchema.optional(),
  audience: surveyAudienceSchema.optional(),
});

export const surveyQuestionCreateSchema = z.object({
  surveyId: surveyIdSchema,
  label: z.string().trim().min(1).max(500),
  type: surveyQuestionTypeSchema,
  required: z.boolean().default(false),
  options: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
});

export const surveyResponseCreateSchema = z.object({
  surveyId: surveyIdSchema,
  answers: z.record(z.string().max(100), z.unknown()),
  locale: z.string().trim().max(20).optional(),
  anonymous: z.boolean().default(true),
});

export const adminMutationSchema = z.enum([
  'survey:create',
  'survey:update',
  'survey:delete',
  'question:create',
  'question:update',
  'question:delete',
  'response:export',
  'admin:update-role',
]);

export type AdminRole = z.infer<typeof adminRoleSchema>;
export type SurveyCreateInput = z.infer<typeof surveyCreateSchema>;
export type SurveyUpdateInput = z.infer<typeof surveyUpdateSchema>;
export type SurveyQuestionCreateInput = z.infer<typeof surveyQuestionCreateSchema>;
export type SurveyResponseCreateInput = z.infer<typeof surveyResponseCreateSchema>;

export function can(role: AdminRole, mutation: z.infer<typeof adminMutationSchema>): boolean {
  if (role === 'owner') return true;
  if (role === 'admin') return mutation !== 'admin:update-role';
  return mutation === 'response:export';
}
