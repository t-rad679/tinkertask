import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { FcmService } from '@/shared/fcm/fcm.service';
import { DevicesRepository } from '@/devices/devices.repository';

@Injectable()
export class SyncHintInterceptor implements NestInterceptor {
  constructor(private devices: DevicesRepository, private fcm: FcmService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const method = req.method;
    const isWrite = method === 'POST' || method === 'PATCH' || method === 'DELETE';

    return next.handle().pipe(
      tap(async () => {
        if (!isWrite || !req.auth) return;
        const deviceId = (req.headers['x-device-id'] as string | undefined)?.trim() || null;
        const tokens = await this.devices.tokensForFanout(req.auth.userId, deviceId);
        await this.fcm.sendSyncHint(tokens);
      }),
    );
  }
}
