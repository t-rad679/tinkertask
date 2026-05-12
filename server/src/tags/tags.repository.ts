import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '@/db/drizzle.module';
import { tags, taskTags, Tag, NewTag } from '@/db/schema';
import { notDeleted } from '@/common/soft-delete/soft-delete.helper';

@Injectable()
export class TagsRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  listForUser(userId: string): Promise<Tag[]> {
    return this.db.select().from(tags).where(and(eq(tags.userId, userId), notDeleted(tags.deletedAt)));
  }

  async findByLowerNames(userId: string, names: string[]): Promise<Tag[]> {
    if (names.length === 0) return [];
    return this.db
      .select()
      .from(tags)
      .where(and(
        eq(tags.userId, userId),
        notDeleted(tags.deletedAt),
        inArray(sql`lower(${tags.name})`, names.map((n) => n.toLowerCase())),
      ));
  }

  async create(userId: string, name: string, color?: string): Promise<Tag> {
    const [t] = await this.db.insert(tags).values({ userId, name, color }).returning();
    return t!;
  }

  async update(userId: string, id: string, patch: Partial<NewTag>) {
    const [u] = await this.db
      .update(tags)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(and(eq(tags.userId, userId), eq(tags.id, id), notDeleted(tags.deletedAt)))
      .returning();
    return u;
  }

  async incrementUseCount(tagIds: string[], delta: number): Promise<void> {
    if (tagIds.length === 0) return;
    await this.db.update(tags).set({ useCount: sql`${tags.useCount} + ${delta}`, updatedAt: sql`now()` }).where(inArray(tags.id, tagIds));
  }

  /**
   * Cascade soft-delete: tag tombstoned, all active task_tags rows tombstoned, dependent task updated_at bumped.
   */
  async cascadeSoftDelete(userId: string, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.update(tags).set({ deletedAt: sql`now()`, updatedAt: sql`now()` }).where(and(eq(tags.userId, userId), eq(tags.id, id)));
      const links = await tx
        .select({ taskId: taskTags.taskId })
        .from(taskTags)
        .where(and(eq(taskTags.userId, userId), eq(taskTags.tagId, id), notDeleted(taskTags.deletedAt)));
      await tx
        .update(taskTags)
        .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
        .where(and(eq(taskTags.userId, userId), eq(taskTags.tagId, id), notDeleted(taskTags.deletedAt)));
      if (links.length > 0) {
        const taskIds = links.map((l) => l.taskId);
        await tx.execute(sql`UPDATE tasks SET updated_at = now() WHERE user_id = ${userId} AND id = ANY(${taskIds as any})`);
      }
    });
  }
}
