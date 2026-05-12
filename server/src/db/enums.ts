import { pgEnum } from 'drizzle-orm/pg-core';

export const taskKind = pgEnum('task_kind', ['task', 'habit']);
export const taskStatus = pgEnum('task_status', ['open', 'completed', 'archived']);
export const devicePlatform = pgEnum('device_platform', ['ios', 'android']);
