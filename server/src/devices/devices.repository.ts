import { Inject, Injectable } from '@nestjs/common';
import { and, eq, ne, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '@/db/drizzle.module';
import { devices, Device, NewDevice } from '@/db/schema';

@Injectable()
export class DevicesRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  list(userId: string) { return this.db.select().from(devices).where(eq(devices.userId, userId)); }

  async upsertByToken(userId: string, fcmToken: string, platform: 'ios' | 'android'): Promise<Device> {
    const existing = await this.db.select().from(devices).where(and(eq(devices.userId, userId), eq(devices.fcmToken, fcmToken))).limit(1);
    if (existing[0]) {
      await this.db.update(devices).set({ lastSeenAt: sql`now()`, platform }).where(eq(devices.id, existing[0].id));
      return existing[0];
    }
    const [d] = await this.db.insert(devices).values({ userId, fcmToken, platform }).returning();
    return d!;
  }

  async remove(userId: string, id: string) {
    await this.db.delete(devices).where(and(eq(devices.userId, userId), eq(devices.id, id)));
  }

  async tokensForFanout(userId: string, excludeDeviceId: string | null): Promise<string[]> {
    const where = excludeDeviceId
      ? and(eq(devices.userId, userId), ne(devices.id, excludeDeviceId))
      : eq(devices.userId, userId);
    const rows = await this.db.select({ token: devices.fcmToken }).from(devices).where(where);
    return rows.map((r) => r.token);
  }
}
