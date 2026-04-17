import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import * as crypto from 'crypto';

import { PaginatedResponse } from '../pagination/paginated-response';

export interface Response<T> {
  status: number;
  message: string;
  data: T;
  meta: {
    request_id: string;
    timestamp: string;
    next_cursor?: string | null;
    total_count?: number;
    per_page?: number;
    current_count?: number;
  };
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const response = httpContext.getResponse();
    
    // Use an existing X-Request-ID or generate a new one securely
    const requestId = request.headers['x-request-id'] || crypto.randomUUID();
    
    // Attach to the request object so the exception filter can read the identical ID if something crashes
    request.requestId = requestId;

    return next.handle().pipe(
      map(data => {
        const isPaginated = data instanceof PaginatedResponse;
        
        // Extract optional message from data if provided, otherwise default to "Success"
        let message = 'Success';
        let pureData = data;

        if (data && typeof data === 'object' && 'message' in data && 'data' in data) {
           message = data.message;
           pureData = data.data;
        }

        return {
          status: response.statusCode,
          message: message,
          data: isPaginated ? data.data : (pureData || {}),
          meta: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            ...(isPaginated ? {
              next_cursor: data.next_cursor,
              total_count: data.total_count,
              per_page: data.per_page,
              current_count: data.current_count,
            } : {}),
          },
        };
      }),
    );
  }
}
