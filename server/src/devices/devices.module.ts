import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DevicesController } from './devices.controller';
import { DevicesRepository } from './devices.repository';
import { FcmModule } from '@/shared/fcm/fcm.module';
import { SyncHintInterceptor } from '@/sync/sync-hint.interceptor';

@Module({
  imports: [FcmModule],
  controllers: [DevicesController],
  providers: [
    DevicesRepository,
    SyncHintInterceptor,
    { provide: APP_INTERCEPTOR, useExisting: SyncHintInterceptor },
  ],
  exports: [DevicesRepository],
})
export class DevicesModule {}
