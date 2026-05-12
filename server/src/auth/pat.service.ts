import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

export const PAT_PREFIX = 'tt_pat_';

@Injectable()
export class PatService {
  generateToken(): string {
    const random = randomBytes(32).toString('base64url');
    return `${PAT_PREFIX}${random}`;
  }

  hash(token: string): Promise<string> {
    return bcrypt.hash(token, 12);
  }

  verify(token: string, hash: string): Promise<boolean> {
    return bcrypt.compare(token, hash);
  }

  isPatToken(value: string): boolean {
    return value.startsWith(PAT_PREFIX);
  }
}
