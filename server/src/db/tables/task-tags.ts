import { pgTable, uuid, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { tasks } from './tasks';
import { tags } from './tags';

export const taskTags = pgTable(
  'task_tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().references(() => users.id),
    taskId: uuid('task_id').notNull().references(() => tasks.id),
    tagId: uuid('tag_id').notNull().references(() => tags.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    pairUniq: uniqueIndex('task_tags_pair_uniq')
      .on(t.taskId, t.tagId)
      .where(sql`${t.deletedAt} IS NULL`),
    byTask: index('task_tags_task_idx').on(t.taskId).where(sql`${t.deletedAt} IS NULL`),
    byTag: index('task_tags_tag_idx').on(t.tagId).where(sql`${t.deletedAt} IS NULL`),
    syncDelta: index('task_tags_user_updated_idx').on(t.userId, t.updatedAt),
  }),
);

export type TaskTag = typeof taskTags.$inferSelect;
export type NewTaskTag = typeof taskTags.$inferInsert;
