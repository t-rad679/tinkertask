import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '@/db/drizzle.module';
import { personalAccessTokens, Pat } from '@/db/schema';

@Injectable()
export class PatRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  // NOTE: PAT lookup is O(N×bcrypt). The bcrypt salt is random, so a hash-equality
  // lookup wouldn't work — same plaintext token yields different hashes per call.
  // For personal scale this is acceptable (spec §18 #11). If scaled up, add a fast
  // HMAC-SHA256(token) fingerprint column as a pre-filter, then bcrypt only against
  // matching rows.
  async listActive(): Promise<Pat[]> {
    return this.db
      .select()
      .from(personalAccessTokens)
      .where(isNull(personalAccessTokens.revokedAt));
  }

  async bumpLastUsed(id: string): Promise<void> {
    await this.db
      .update(personalAccessTokens)
      .set({ lastUsedAt: sql`now()` })
      .where(eq(personalAccessTokens.id, id));
  }

  async insert(userId: string, name: string, tokenHash: string): Promise<Pat> {
    const [created] = await this.db
      .insert(personalAccessTokens)
      .values({ userId, name, tokenHash })
      .returning();
    return created!;
  }

  async listForUser(userId: string): Promise<Pat[]> {
    return this.db
      .select()
      .from(personalAccessTokens)
      .where(eq(personalAccessTokens.userId, userId));
  }

  async revoke(id: string, userId: string): Promise<void> {
    await this.db
      .update(personalAccessTokens)
      .set({ revokedAt: sql`now()` })
      .where(
        and(
          eq(personalAccessTokens.id, id),
          eq(personalAccessTokens.userId, userId),
        ),
      );
  }
}
