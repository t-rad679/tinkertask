import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CounterStore } from './counter.store';
import { RateLimitGuard } from './rate-limit.guard';

@Module({
  providers: [
    CounterStore,
    RateLimitGuard,
    // Register AFTER FirebaseOrPatGuard (which is registered in AuthModule).
    // NestJS APP_GUARD providers execute in registration order: AuthModule is
    // imported first in AppModule, so FirebaseOrPatGuard runs before this guard.
    { provide: APP_GUARD, useExisting: RateLimitGuard },
  ],
  exports: [CounterStore],
})
export class RateLimitModule {}
