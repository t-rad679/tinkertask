import { pgTable, uuid, text, date, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { tasks } from './tasks';

export const completions = pgTable(
  'completions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().references(() => users.id),
    taskId: uuid('task_id').notNull().references(() => tasks.id),
    completedOn: date('completed_on').notNull(),
    value: integer('value').notNull().default(1),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    syncDelta: index('completions_user_updated_idx').on(t.userId, t.updatedAt),
    byTaskDate: index('completions_task_date_idx').on(t.taskId, t.completedOn).where(sql`${t.deletedAt} IS NULL`),
  }),
);

export type Completion = typeof completions.$inferSelect;
export type NewCompletion = typeof completions.$inferInsert;
