import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '@/db/drizzle.module';
import { scopeTypes, ScopeType, NewScopeType, scopes } from '@/db/schema';
import { notDeleted } from '@/common/soft-delete/soft-delete.helper';

@Injectable()
export class ScopeTypesRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  listForUser(userId: string): Promise<ScopeType[]> {
    return this.db
      .select()
      .from(scopeTypes)
      .where(and(eq(scopeTypes.userId, userId), notDeleted(scopeTypes.deletedAt)))
      .orderBy(asc(scopeTypes.position));
  }

  async findById(userId: string, id: string): Promise<ScopeType | undefined> {
    const rows = await this.db
      .select()
      .from(scopeTypes)
      .where(and(eq(scopeTypes.userId, userId), eq(scopeTypes.id, id), notDeleted(scopeTypes.deletedAt)))
      .limit(1);
    return rows[0];
  }

  async create(values: NewScopeType): Promise<ScopeType> {
    const [created] = await this.db.insert(scopeTypes).values(values).returning();
    return created!;
  }

  async update(userId: string, id: string, patch: Partial<NewScopeType>): Promise<ScopeType | undefined> {
    const [updated] = await this.db
      .update(scopeTypes)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(and(eq(scopeTypes.userId, userId), eq(scopeTypes.id, id), notDeleted(scopeTypes.deletedAt)))
      .returning();
    return updated;
  }

  async softDelete(userId: string, id: string): Promise<void> {
    await this.db
      .update(scopeTypes)
      .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(scopeTypes.userId, userId), eq(scopeTypes.id, id)));
  }

  async countActiveScopesUsingType(userId: string, scopeTypeId: string): Promise<number> {
    const rows = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(scopes)
      .where(and(eq(scopes.userId, userId), eq(scopes.scopeTypeId, scopeTypeId), notDeleted(scopes.deletedAt)));
    return rows[0]?.n ?? 0;
  }
}
