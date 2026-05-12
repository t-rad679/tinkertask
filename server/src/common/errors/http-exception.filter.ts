import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ApiException } from './api.exception';
import { ErrorCodes } from './error-codes';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();

    if (exception instanceof ApiException) {
      return res.status(exception.getStatus()).json({
        error: { code: exception.code, message: exception.message, details: exception.details ?? {} },
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse() as any;
      // class-validator throws BadRequestException with message array
      if (Array.isArray(payload?.message)) {
        return res.status(status).json({
          error: { code: ErrorCodes.validation_failed, message: 'Request validation failed', details: { errors: payload.message } },
        });
      }
      // If the payload already carries a structured error envelope (e.g. from guards
      // that throw ForbiddenException({ error: { code, message } })), pass it through.
      if (payload?.error?.code) {
        return res.status(status).json({
          error: {
            code: payload.error.code,
            message: payload.error.message ?? exception.message,
            details: payload.error.details ?? {},
          },
        });
      }
      const code =
        status === HttpStatus.UNAUTHORIZED ? ErrorCodes.unauthorized
        : status === HttpStatus.FORBIDDEN ? ErrorCodes.forbidden
        : status === HttpStatus.NOT_FOUND ? ErrorCodes.not_found
        : ErrorCodes.internal;
      const message = typeof payload === 'string' ? payload : (payload?.message ?? exception.message);
      return res.status(status).json({ error: { code, message, details: {} } });
    }

    this.logger.error('Unhandled exception', exception as any);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: { code: ErrorCodes.internal, message: 'Internal server error', details: {} },
    });
  }
}
