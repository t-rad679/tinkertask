import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, inArray, isNotNull, or, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '@/db/drizzle.module';
import {
  tasks,
  completions,
  scopes,
  scopeTypes,
  tags,
  taskTags,
  views,
  dashboards,
  dashboardViews,
  devices,
} from '@/db/schema';

export interface SyncDelta {
  now: string;
  next_cursor: null;
  data: {
    tasks: unknown[];
    completions: unknown[];
    scopes: unknown[];
    scope_types: unknown[];
    tags: unknown[];
    task_tags: unknown[];
    views: unknown[];
    dashboards: unknown[];
    dashboard_views: unknown[];
    devices: unknown[];
  };
}

/** Returns a WHERE fragment that matches rows updated-or-deleted after `since`. */
function deltaWhere(updatedAt: any, deletedAt: any, since: Date) {
  return or(gt(updatedAt, since), and(isNotNull(deletedAt), gt(deletedAt, since)))!;
}

@Injectable()
export class SyncService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async delta(userId: string, since: Date): Promise<SyncDelta> {
    const [
      taskRows,
      completionRows,
      scopeRows,
      scopeTypeRows,
      tagRows,
      taskTagRows,
      viewRows,
      dashboardRows,
      dashboardViewRows,
      deviceRows,
    ] = await Promise.all([
      this.db.select().from(tasks).where(and(eq(tasks.userId, userId), deltaWhere(tasks.updatedAt, tasks.deletedAt, since))),
      this.db.select().from(completions).where(and(eq(completions.userId, userId), deltaWhere(completions.updatedAt, completions.deletedAt, since))),
      this.db.select().from(scopes).where(and(eq(scopes.userId, userId), deltaWhere(scopes.updatedAt, scopes.deletedAt, since))),
      this.db.select().from(scopeTypes).where(and(eq(scopeTypes.userId, userId), deltaWhere(scopeTypes.updatedAt, scopeTypes.deletedAt, since))),
      this.db.select().from(tags).where(and(eq(tags.userId, userId), deltaWhere(tags.updatedAt, tags.deletedAt, since))),
      this.db.select().from(taskTags).where(and(eq(taskTags.userId, userId), deltaWhere(taskTags.updatedAt, taskTags.deletedAt, since))),
      this.db.select().from(views).where(and(eq(views.userId, userId), deltaWhere(views.updatedAt, views.deletedAt, since))),
      this.db.select().from(dashboards).where(and(eq(dashboards.userId, userId), deltaWhere(dashboards.updatedAt, dashboards.deletedAt, since))),
      // dashboard_views has no userId column — scope via subselect on dashboards.user_id
      // (without this filter, the delta would leak other users' pin/reorder/unpin events
      // once friends share an instance).
      this.db
        .select()
        .from(dashboardViews)
        .where(
          and(
            deltaWhere(dashboardViews.updatedAt, dashboardViews.deletedAt, since),
            inArray(
              dashboardViews.dashboardId,
              this.db
                .select({ id: dashboards.id })
                .from(dashboards)
                .where(eq(dashboards.userId, userId)),
            ),
          ),
        ),
      this.db.select().from(devices).where(eq(devices.userId, userId)),
    ]);

    return {
      now: new Date().toISOString(),
      next_cursor: null,
      data: {
        tasks: taskRows,
        completions: completionRows,
        scopes: scopeRows,
        scope_types: scopeTypeRows,
        tags: tagRows,
        task_tags: taskTagRows,
        views: viewRows,
        dashboards: dashboardRows,
        dashboard_views: dashboardViewRows,
        devices: deviceRows,
      },
    };
  }
}
