import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';

@Injectable()
export class FirebaseService {
  readonly app: App;

  constructor(private cfg: ConfigService) {
    const existing = getApps()[0];
    this.app =
      existing ??
      initializeApp({
        credential: cert({
          projectId: cfg.get<string>('FIREBASE_PROJECT_ID'),
          clientEmail: cfg.get<string>('FIREBASE_CLIENT_EMAIL'),
          privateKey: cfg.get<string>('FIREBASE_PRIVATE_KEY')!.replace(/\\n/g, '\n'),
        }),
      });
  }

  async verifyIdToken(token: string): Promise<DecodedIdToken> {
    return getAuth(this.app).verifyIdToken(token);
  }
}
