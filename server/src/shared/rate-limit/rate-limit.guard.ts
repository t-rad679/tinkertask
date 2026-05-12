import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { CounterStore } from './counter.store';
import { ApiException } from '@/common/errors/api.exception';
import { ErrorCodes } from '@/common/errors/error-codes';
import { AuthContext } from '@/auth/user.decorator';

const WINDOW_MS = 60_000; // 1 minute

// In test mode, use very high caps so existing e2e suites never trip the limit.
const IS_TEST = process.env['NODE_ENV'] === 'test';
const READ_MAX = IS_TEST ? 1_000_000 : 600;
const WRITE_MAX = IS_TEST ? 1_000_000 : 120;

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private store: CounterStore) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{
      method: string;
      auth?: AuthContext;
      res: { setHeader(name: string, value: string | number): void };
    }>();

    // If auth hasn't been resolved yet (guard ordering issue), allow through
    if (!req.auth) return true;

    const { userId } = req.auth;
    const isWrite = req.method !== 'GET' && req.method !== 'HEAD';
    const max = isWrite ? WRITE_MAX : READ_MAX;
    const keyPrefix = isWrite ? 'w' : 'r';
    const key = `${keyPrefix}:${userId}`;

    const allowed = this.store.hit(key, WINDOW_MS, max);
    if (!allowed) {
      const retryAfter = this.store.retryAfterSeconds(key, WINDOW_MS);
      const res = ctx.switchToHttp().getResponse<{ setHeader(name: string, value: string | number): void }>();
      res.setHeader('Retry-After', retryAfter);
      throw new ApiException(
        isWrite ? ErrorCodes.rate_limited_write : ErrorCodes.rate_limited_read,
        `Rate limit exceeded. Retry after ${retryAfter}s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
