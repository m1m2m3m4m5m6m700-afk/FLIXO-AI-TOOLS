import { pgEnum, pgTable, text, timestamp, uuid, jsonb, boolean } from 'drizzle-orm/pg-core';

export const adminRoleEnum = pgEnum('admin_role', ['owner', 'admin', 'analyst']);
export const surveyStatusEnum = pgEnum('survey_status', ['draft', 'active', 'archived']);
export const surveyAudienceEnum = pgEnum('survey_audience', ['all', 'signed-in', 'tool-users']);
export const surveyQuestionTypeEnum = pgEnum('survey_question_type', ['text', 'textarea', 'rating', 'select', 'multiselect', 'boolean']);

export const adminUsers = pgTable('admin_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  role: adminRoleEnum('role').notNull().default('analyst'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const surveys = pgTable('surveys', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  status: surveyStatusEnum('status').notNull().default('draft'),
  audience: surveyAudienceEnum('audience').notNull().default('all'),
  createdBy: uuid('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const surveyQuestions = pgTable('survey_questions', {
  id: uuid('id').defaultRandom().primaryKey(),
  surveyId: uuid('survey_id').notNull().references(() => surveys.id, { onDelete: 'cascade' }),
  position: text('position').notNull(),
  label: text('label').notNull(),
  type: surveyQuestionTypeEnum('type').notNull(),
  required: boolean('required').notNull().default(false),
  options: jsonb('options').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const surveyResponses = pgTable('survey_responses', {
  id: uuid('id').defaultRandom().primaryKey(),
  surveyId: uuid('survey_id').notNull().references(() => surveys.id, { onDelete: 'cascade' }),
  answers: jsonb('answers').$type<Record<string, unknown>>().notNull(),
  locale: text('locale'),
  anonymous: boolean('anonymous').notNull().default(true),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
});

export const adminAuditEvents = pgTable('admin_audit_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorAdminId: uuid('actor_admin_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
