import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '@/db/drizzle.module';
import { dashboards, dashboardViews, Dashboard, NewDashboard, DashboardView, NewDashboardView } from '@/db/schema';
import { notDeleted } from '@/common/soft-delete/soft-delete.helper';

@Injectable()
export class DashboardsRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  list(userId: string) { return this.db.select().from(dashboards).where(and(eq(dashboards.userId, userId), notDeleted(dashboards.deletedAt))); }

  async findById(userId: string, id: string) {
    const rows = await this.db.select().from(dashboards).where(and(eq(dashboards.userId, userId), eq(dashboards.id, id), notDeleted(dashboards.deletedAt))).limit(1);
    return rows[0];
  }

  async create(values: NewDashboard): Promise<Dashboard> {
    const [d] = await this.db.insert(dashboards).values(values).returning();
    return d!;
  }

  async update(userId: string, id: string, patch: Partial<NewDashboard>) {
    const [d] = await this.db.update(dashboards).set({ ...patch, updatedAt: sql`now()` }).where(and(eq(dashboards.userId, userId), eq(dashboards.id, id), notDeleted(dashboards.deletedAt))).returning();
    return d;
  }

  async softDelete(userId: string, id: string) {
    await this.db.update(dashboards).set({ deletedAt: sql`now()`, updatedAt: sql`now()` }).where(and(eq(dashboards.userId, userId), eq(dashboards.id, id)));
  }

  async listPinnedViews(dashboardId: string): Promise<DashboardView[]> {
    return this.db.select().from(dashboardViews).where(and(eq(dashboardViews.dashboardId, dashboardId), notDeleted(dashboardViews.deletedAt))).orderBy(asc(dashboardViews.position));
  }

  async pinView(values: NewDashboardView): Promise<DashboardView> {
    const [dv] = await this.db.insert(dashboardViews).values(values).returning();
    return dv!;
  }

  async setPosition(id: string, position: number) {
    await this.db.update(dashboardViews).set({ position, updatedAt: sql`now()` }).where(eq(dashboardViews.id, id));
  }

  async unpin(dashboardId: string, viewId: string) {
    await this.db
      .update(dashboardViews)
      .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(dashboardViews.dashboardId, dashboardId), eq(dashboardViews.viewId, viewId), notDeleted(dashboardViews.deletedAt)));
  }
}
