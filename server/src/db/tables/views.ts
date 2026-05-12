import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const views = pgTable(
  'views',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().references(() => users.id),
    name: text('name').notNull(),
    query: jsonb('query').notNull(),
    icon: text('icon'),
    color: text('color'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    syncDelta: index('views_user_updated_idx').on(t.userId, t.updatedAt),
  }),
);

export type View = typeof views.$inferSelect;
export type NewView = typeof views.$inferInsert;
