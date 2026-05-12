import { pgTable, uuid, text, timestamp, integer, jsonb, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { scopes } from './scopes';
import { taskKind, taskStatus } from '../enums';

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().references(() => users.id),
    scopeId: uuid('scope_id').references(() => scopes.id),
    title: text('title').notNull(),
    body: text('body'),
    kind: taskKind('kind').notNull(),
    status: taskStatus('status').notNull().default('open'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    recurrence: jsonb('recurrence'),
    targetValue: integer('target_value'),
    targetPeriod: text('target_period'), // 'day' | 'week' | null — kept as text per §4
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    targetCoupling: check(
      'tasks_target_coupling',
      sql`(${t.targetValue} IS NULL) = (${t.targetPeriod} IS NULL)`,
    ),
    targetPeriodEnum: check(
      'tasks_target_period_enum',
      sql`${t.targetPeriod} IS NULL OR ${t.targetPeriod} IN ('day', 'week')`,
    ),
    syncDelta: index('tasks_user_updated_idx').on(t.userId, t.updatedAt),
    byScope: index('tasks_user_scope_idx').on(t.userId, t.scopeId).where(sql`${t.deletedAt} IS NULL`),
    byKind: index('tasks_user_kind_idx').on(t.userId, t.kind).where(sql`${t.deletedAt} IS NULL`),
    byStatus: index('tasks_user_status_idx').on(t.userId, t.status).where(sql`${t.deletedAt} IS NULL`),
  }),
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
