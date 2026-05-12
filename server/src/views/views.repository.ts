import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '@/db/drizzle.module';
import { views, View, NewView, tasks, Task } from '@/db/schema';
import { notDeleted } from '@/common/soft-delete/soft-delete.helper';
import { ScopesRepository } from '@/scopes/scopes.repository';
import { compileViewQuery } from '@/shared/query/compile';
import { ViewQuery } from '@/shared/query/view-query.types';

@Injectable()
export class ViewsRepository {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private scopes: ScopesRepository,
  ) {}

  list(userId: string): Promise<View[]> {
    return this.db
      .select()
      .from(views)
      .where(and(eq(views.userId, userId), notDeleted(views.deletedAt)));
  }

  async findById(userId: string, id: string): Promise<View | undefined> {
    const rows = await this.db
      .select()
      .from(views)
      .where(and(eq(views.userId, userId), eq(views.id, id), notDeleted(views.deletedAt)))
      .limit(1);
    return rows[0];
  }

  async create(values: NewView): Promise<View> {
    const [v] = await this.db.insert(views).values(values).returning();
    return v!;
  }

  async update(userId: string, id: string, patch: Partial<NewView>): Promise<View | undefined> {
    const [v] = await this.db
      .update(views)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(and(eq(views.userId, userId), eq(views.id, id), notDeleted(views.deletedAt)))
      .returning();
    return v;
  }

  async softDelete(userId: string, id: string): Promise<void> {
    await this.db
      .update(views)
      .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(views.userId, userId), eq(views.id, id)));
  }

  async run(userId: string, query: ViewQuery, limit = 50): Promise<Task[]> {
    const { where, sortClauses } = await compileViewQuery(query, {
      userId,
      now: new Date(),
      resolveScopeDescendants: async (root) => {
        const ids = await this.scopes.descendantIds(userId, root);
        return ids.length > 0 ? ids : [root];
      },
    });
    let q = this.db.select().from(tasks).where(where).limit(limit) as any;
    if (sortClauses.length > 0) q = q.orderBy(...sortClauses);
    return q as Promise<Task[]>;
  }
}
