import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '@/db/drizzle.module';
import { taskTags } from '@/db/schema';
import { notDeleted } from '@/common/soft-delete/soft-delete.helper';

@Injectable()
export class TaskTagsRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async activeTagIdsForTask(userId: string, taskId: string): Promise<string[]> {
    const rows = await this.db
      .select({ tagId: taskTags.tagId })
      .from(taskTags)
      .where(and(eq(taskTags.userId, userId), eq(taskTags.taskId, taskId), notDeleted(taskTags.deletedAt)));
    return rows.map((r) => r.tagId);
  }

  async attach(userId: string, taskId: string, tagIds: string[]) {
    if (tagIds.length === 0) return;
    await this.db.insert(taskTags).values(tagIds.map((tagId) => ({ userId, taskId, tagId })));
  }

  async detachByTagIds(userId: string, taskId: string, tagIds: string[]) {
    if (tagIds.length === 0) return;
    await this.db
      .update(taskTags)
      .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(taskTags.userId, userId), eq(taskTags.taskId, taskId), inArray(taskTags.tagId, tagIds), notDeleted(taskTags.deletedAt)));
  }

  async detachAllForTask(userId: string, taskId: string) {
    await this.db
      .update(taskTags)
      .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(taskTags.userId, userId), eq(taskTags.taskId, taskId), notDeleted(taskTags.deletedAt)));
  }
}
