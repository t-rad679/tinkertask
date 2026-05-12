import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '@/db/drizzle.module';
import { users, User } from '@/db/schema';

@Injectable()
export class UsersRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findById(id: string): Promise<User | undefined> {
    const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0];
  }

  async upsertOnFirstAuth(id: string): Promise<User> {
    // Atomic upsert — avoids TOCTOU race when two requests for the same uid hit at once.
    const inserted = await this.db
      .insert(users)
      .values({ id })
      .onConflictDoNothing({ target: users.id })
      .returning();
    if (inserted[0]) return inserted[0];
    const existing = await this.findById(id);
    if (!existing) throw new Error(`users row for ${id} missing after upsert`);
    return existing;
  }
}
