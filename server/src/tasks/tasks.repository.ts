import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '@/db/drizzle.module';
import { tasks, Task, NewTask } from '@/db/schema';
import { notDeleted } from '@/common/soft-delete/soft-delete.helper';

@Injectable()
export class TasksRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findById(userId: string, id: string): Promise<Task | undefined> {
    const rows = await this.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.id, id), notDeleted(tasks.deletedAt)))
      .limit(1);
    return rows[0];
  }

  listForUser(userId: string): Promise<Task[]> {
    return this.db.select().from(tasks).where(and(eq(tasks.userId, userId), notDeleted(tasks.deletedAt)));
  }

  async create(values: NewTask): Promise<Task> {
    const [created] = await this.db.insert(tasks).values(values).returning();
    return created!;
  }

  async update(userId: string, id: string, patch: Partial<NewTask>): Promise<Task | undefined> {
    const [updated] = await this.db
      .update(tasks)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(and(eq(tasks.userId, userId), eq(tasks.id, id), notDeleted(tasks.deletedAt)))
      .returning();
    return updated;
  }

  async softDelete(userId: string, id: string): Promise<void> {
    await this.db
      .update(tasks)
      .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(tasks.userId, userId), eq(tasks.id, id)));
  }
}
