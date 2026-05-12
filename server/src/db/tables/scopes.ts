import { pgTable, uuid, text, timestamp, uniqueIndex, index, foreignKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { scopeTypes } from './scope-types';

export const scopes = pgTable(
  'scopes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().references(() => users.id),
    scopeTypeId: uuid('scope_type_id').notNull().references(() => scopeTypes.id),
    parentId: uuid('parent_id'),
    name: text('name').notNull(),
    color: text('color'),
    icon: text('icon'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    parentFk: foreignKey({ columns: [t.parentId], foreignColumns: [t.id] }),
    // Sibling uniqueness for nested scopes (parent_id IS NOT NULL).
    // Btree uniques treat NULL != NULL, so this index does not cover root-level scopes.
    siblingNameUniq: uniqueIndex('scopes_sibling_lower_name_uniq')
      .on(t.userId, t.parentId, sql`lower(${t.name})`)
      .where(sql`${t.deletedAt} IS NULL AND ${t.parentId} IS NOT NULL`),
    // Separate partial unique to cover root scopes (parent_id IS NULL).
    rootNameUniq: uniqueIndex('scopes_root_lower_name_uniq')
      .on(t.userId, sql`lower(${t.name})`)
      .where(sql`${t.deletedAt} IS NULL AND ${t.parentId} IS NULL`),
    childrenLookup: index('scopes_user_parent_idx').on(t.userId, t.parentId).where(sql`${t.deletedAt} IS NULL`),
    byType: index('scopes_user_type_idx').on(t.userId, t.scopeTypeId).where(sql`${t.deletedAt} IS NULL`),
    syncDelta: index('scopes_user_updated_idx').on(t.userId, t.updatedAt),
  }),
);

export type Scope = typeof scopes.$inferSelect;
export type NewScope = typeof scopes.$inferInsert;
