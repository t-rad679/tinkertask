import { pgTable, uuid, integer, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { dashboards } from './dashboards';
import { views } from './views';

export const dashboardViews = pgTable(
  'dashboard_views',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dashboardId: uuid('dashboard_id').notNull().references(() => dashboards.id),
    viewId: uuid('view_id').notNull().references(() => views.id),
    position: integer('position').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    pairUniq: uniqueIndex('dashboard_views_pair_uniq')
      .on(t.dashboardId, t.viewId)
      .where(sql`${t.deletedAt} IS NULL`),
    byDashboard: index('dashboard_views_dashboard_idx').on(t.dashboardId).where(sql`${t.deletedAt} IS NULL`),
  }),
);

export type DashboardView = typeof dashboardViews.$inferSelect;
export type NewDashboardView = typeof dashboardViews.$inferInsert;
