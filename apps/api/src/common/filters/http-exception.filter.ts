import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Standardized error envelope for every response. Deliberately strips
 * anything beyond a safe message/code — internal errors (Prisma errors,
 * stack traces, provider payloads) are logged server-side only and never
 * echoed to the client, so PII (e.g. a decrypted phone number surfacing in
 * an error) can never leak via a 500 body.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        message = (b.message as string | string[]) ?? exception.message;
        code = (b.error as string) ?? code;
      }
      code = status === HttpStatus.INTERNAL_SERVER_ERROR ? code : HttpException.name;
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error on ${request.method} ${request.url}: ${exception.message}`, exception.stack);
    }

    response.status(status).json({
      error: {
        code: status,
        message,
        path: request.url,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
