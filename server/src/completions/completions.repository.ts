import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '@/db/drizzle.module';
import { completions, Completion, NewCompletion } from '@/db/schema';
import { notDeleted } from '@/common/soft-delete/soft-delete.helper';

@Injectable()
export class CompletionsRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}
  list(userId: string) { return this.db.select().from(completions).where(and(eq(completions.userId, userId), notDeleted(completions.deletedAt))); }
  async findById(userId: string, id: string) {
    const rows = await this.db.select().from(completions).where(and(eq(completions.userId, userId), eq(completions.id, id))).limit(1);
    return rows[0];
  }
  async create(values: NewCompletion) {
    const [c] = await this.db.insert(completions).values(values).returning();
    return c!;
  }
  async update(userId: string, id: string, patch: Partial<NewCompletion>) {
    const [u] = await this.db.update(completions).set({ ...patch, updatedAt: sql`now()` }).where(and(eq(completions.userId, userId), eq(completions.id, id))).returning();
    return u;
  }
  async softDelete(userId: string, id: string) {
    await this.db.update(completions).set({ deletedAt: sql`now()`, updatedAt: sql`now()` }).where(and(eq(completions.userId, userId), eq(completions.id, id)));
  }
}
