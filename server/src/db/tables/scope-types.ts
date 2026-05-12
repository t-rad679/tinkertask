import { pgTable, uuid, text, integer, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const scopeTypes = pgTable(
  'scope_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().references(() => users.id),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    color: text('color'),
    icon: text('icon'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    uniqLowerName: uniqueIndex('scope_types_user_lower_name_uniq')
      .on(t.userId, sql`lower(${t.name})`)
      .where(sql`${t.deletedAt} IS NULL`),
    byPosition: index('scope_types_user_position_idx')
      .on(t.userId, t.position)
      .where(sql`${t.deletedAt} IS NULL`),
    syncDelta: index('scope_types_user_updated_idx').on(t.userId, t.updatedAt),
  }),
);

export type ScopeType = typeof scopeTypes.$inferSelect;
export type NewScopeType = typeof scopeTypes.$inferInsert;
