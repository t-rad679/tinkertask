// parse.service.ts
import { HttpStatus, Injectable } from '@nestjs/common';
import { parseCaptureSyntax } from '@/shared/syntax/parser';
import { ApiException } from '@/common/errors/api.exception';
import { ErrorCodes } from '@/common/errors/error-codes';
import { ParsedTask } from '@/shared/syntax/parsed-task';

@Injectable()
export class ParseService {
  parse(text: string): ParsedTask {
    if (text.length > 2000) {
      throw new ApiException(ErrorCodes.validation_failed, 'text exceeds 2000 chars', HttpStatus.BAD_REQUEST);
    }
    if (text.includes('\n')) {
      throw new ApiException(ErrorCodes.parse_failed, 'multi-line input is not supported', HttpStatus.BAD_REQUEST);
    }
    try {
      return parseCaptureSyntax(text, { today: new Date(), timezone: 'UTC' });
    } catch (e: any) {
      throw new ApiException(
        ErrorCodes.parse_failed,
        e.message || 'parse failed',
        HttpStatus.BAD_REQUEST,
        { position: e.position ?? null },
      );
    }
  }
}
