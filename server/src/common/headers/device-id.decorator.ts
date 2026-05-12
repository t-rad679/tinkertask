import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const DeviceId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string | null => {
    const req = ctx.switchToHttp().getRequest();
    const raw = req.headers['x-device-id'];
    if (!raw || typeof raw !== 'string') return null;
    // UUID-ish sanity: 8-4-4-4-12 hex; relax to "non-empty" if you want broader keys
    return raw.trim() || null;
  },
);
