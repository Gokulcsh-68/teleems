import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as crypto from 'crypto';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const isHttpException = 
      exception instanceof HttpException || 
      (exception && typeof (exception as any).getStatus === 'function' && typeof (exception as any).getResponse === 'function');

    const status =
      isHttpException
        ? (exception as any).getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      console.error('[AllExceptionsFilter] Caught 500 error:', exception);
    }

    const exceptionResponse = isHttpException ? (exception as any).getResponse() : null;
    
    // Default meanings from Teleems Spec 1.5
    const statusMeanings: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]:
        'Validation error; details array lists field-level errors.',
      [HttpStatus.UNAUTHORIZED]: 'Missing or invalid/expired JWT.',
      [HttpStatus.FORBIDDEN]:
        'Valid JWT but role lacks permission for this resource.',
      [HttpStatus.NOT_FOUND]:
        "Resource does not exist or is outside caller's scope.",
      [HttpStatus.CONFLICT]:
        'Duplicate resource or state conflict (idempotency violation).',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'Business logic validation failure.',
      [HttpStatus.TOO_MANY_REQUESTS]:
        'Rate limit exceeded; Retry-After header provided.',
      [HttpStatus.INTERNAL_SERVER_ERROR]:
        'Unexpected server error; request_id for support reference.',
      [HttpStatus.SERVICE_UNAVAILABLE]:
        'Downstream dependency unavailable; circuit breaker open.',
    };

    let message = statusMeanings[status] || 'Internal server error';
    let details: any = [];

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null
    ) {
      const resObj = exceptionResponse as any;
      const rawMessage = resObj.message;

      if (Array.isArray(rawMessage)) {
        // If it's an array (Validation Errors), use a summary for 'message' and keep 'details' as the array
        message = statusMeanings[status] || 'Validation failed';
        details = rawMessage;
      } else {
        message = rawMessage || message;
        details = resObj.details || [];
      }
    }

    const requestId =
      request.requestId ||
      request.headers['x-request-id'] ||
      crypto.randomUUID();

    // Special handling for 429 Retry-After header as per spec
    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      const retryAfter = response.getHeader('Retry-After');
      if (retryAfter) {
        response.header('Retry-After', String(retryAfter));
      }
    }

    response.status(status).json({
      error: {
        code: `ERR_${status}`,
        message: status === HttpStatus.INTERNAL_SERVER_ERROR && exception instanceof Error ? `Server Error: ${exception.message}` : message,
        details: details.length > 0 ? details : undefined,
        request_id: requestId,
      },
    });
  }
}
