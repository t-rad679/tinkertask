import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '@/db/drizzle.module';
import { scopes, Scope, NewScope, tasks } from '@/db/schema';
import { notDeleted } from '@/common/soft-delete/soft-delete.helper';

@Injectable()
export class ScopesRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  listForUser(userId: string): Promise<Scope[]> {
    return this.db.select().from(scopes).where(and(eq(scopes.userId, userId), notDeleted(scopes.deletedAt)));
  }

  async findById(userId: string, id: string): Promise<Scope | undefined> {
    const rows = await this.db
      .select()
      .from(scopes)
      .where(and(eq(scopes.userId, userId), eq(scopes.id, id), notDeleted(scopes.deletedAt)))
      .limit(1);
    return rows[0];
  }

  async create(values: NewScope): Promise<Scope> {
    const [created] = await this.db.insert(scopes).values(values).returning();
    return created!;
  }

  async update(userId: string, id: string, patch: Partial<NewScope>): Promise<Scope | undefined> {
    const [updated] = await this.db
      .update(scopes)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(and(eq(scopes.userId, userId), eq(scopes.id, id), notDeleted(scopes.deletedAt)))
      .returning();
    return updated;
  }

  /**
   * Recursive CTE — collect this scope id + every descendant id. Used by cascade tombstone.
   */
  async descendantIds(userId: string, rootId: string): Promise<string[]> {
    const result = await this.db.execute(sql`
      WITH RECURSIVE tree AS (
        SELECT id FROM scopes WHERE id = ${rootId} AND user_id = ${userId} AND deleted_at IS NULL
        UNION ALL
        SELECT s.id FROM scopes s JOIN tree t ON s.parent_id = t.id WHERE s.user_id = ${userId} AND s.deleted_at IS NULL
      )
      SELECT id FROM tree
    `);
    return (result as any[]).map((r) => r.id as string);
  }

  /**
   * Atomic cascade delete: tombstone the root + all descendants; null out tasks.scope_id; bump tasks.updated_at.
   */
  async cascadeSoftDelete(userId: string, rootId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const ids = await tx.execute(sql`
        WITH RECURSIVE tree AS (
          SELECT id FROM scopes WHERE id = ${rootId} AND user_id = ${userId} AND deleted_at IS NULL
          UNION ALL
          SELECT s.id FROM scopes s JOIN tree t ON s.parent_id = t.id WHERE s.user_id = ${userId} AND s.deleted_at IS NULL
        )
        SELECT id FROM tree
      `);
      const idList = (ids as any[]).map((r) => r.id as string);
      if (idList.length === 0) return;
      await tx
        .update(scopes)
        .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
        .where(and(eq(scopes.userId, userId), inArray(scopes.id, idList)));
      await tx
        .update(tasks)
        .set({ scopeId: null, updatedAt: sql`now()` })
        .where(and(eq(tasks.userId, userId), inArray(tasks.scopeId, idList)));
    });
  }
}
