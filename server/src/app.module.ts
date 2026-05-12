import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { DrizzleModule } from './db/drizzle.module';
import { AuthModule } from './auth/auth.module';
import { ScopeTypesModule } from './scope-types/scope-types.module';
import { ScopesModule } from './scopes/scopes.module';
import { TagsModule } from './tags/tags.module';
import { TasksModule } from './tasks/tasks.module';
import { CompletionsModule } from './completions/completions.module';
import { ParseModule } from './parse/parse.module';
import { ViewsModule } from './views/views.module';
import { DashboardsModule } from './dashboards/dashboards.module';
import { DevicesModule } from './devices/devices.module';
import { SyncModule } from './sync/sync.module';
import { RateLimitModule } from './shared/rate-limit/rate-limit.module';

@Module({
  imports: [
    AppConfigModule,
    DrizzleModule,
    // AuthModule MUST come before RateLimitModule so FirebaseOrPatGuard (APP_GUARD)
    // is registered before RateLimitGuard (APP_GUARD). NestJS applies global guards
    // in registration order.
    AuthModule,
    RateLimitModule,
    ScopeTypesModule,
    ScopesModule,
    TagsModule,
    TasksModule,
    CompletionsModule,
    ParseModule,
    ViewsModule,
    DashboardsModule,
    DevicesModule,
    SyncModule,
  ],
})
export class AppModule {}
