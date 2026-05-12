import { Injectable, Logger } from '@nestjs/common';
import { getMessaging } from 'firebase-admin/messaging';
import { FirebaseService } from '@/auth/firebase.service';

@Injectable()
export class FcmService {
  private readonly log = new Logger(FcmService.name);
  constructor(private firebase: FirebaseService) {}

  async sendSyncHint(tokens: string[]) {
    if (tokens.length === 0) return;
    try {
      await getMessaging(this.firebase.app).sendEachForMulticast({
        tokens,
        data: { type: 'sync_hint' },
        android: { priority: 'high' },
        apns: { headers: { 'apns-push-type': 'background', 'apns-priority': '5' }, payload: { aps: { contentAvailable: true } } },
      });
    } catch (e) {
      this.log.warn(`FCM sync_hint dispatch failed: ${(e as Error).message}`);
    }
  }
}
