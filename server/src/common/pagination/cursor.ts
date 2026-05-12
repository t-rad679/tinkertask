import { ApiException } from '../errors/api.exception';
import { ErrorCodes } from '../errors/error-codes';
import { HttpStatus } from '@nestjs/common';

export interface PageCursor {
  updatedAt: string; // ISO-8601
  id: string;
}

export function encodeCursor(c: PageCursor): string {
  return Buffer.from(JSON.stringify(c), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string | null | undefined): PageCursor | null {
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as PageCursor;
    if (typeof parsed.updatedAt !== 'string' || typeof parsed.id !== 'string') {
      throw new Error('bad shape');
    }
    return parsed;
  } catch {
    throw new ApiException(ErrorCodes.invalid_query, 'Invalid cursor', HttpStatus.BAD_REQUEST);
  }
}
