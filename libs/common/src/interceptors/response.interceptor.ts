import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
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
    pagination?: {
      next_cursor?: string | null;
      total_count: number;
      per_page: number;
      current_count: number;
      page: number;
      total_pages: number;
    };
  };
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const response = httpContext.getResponse();

    const requestId = request.headers['x-request-id'] || crypto.randomUUID();
    request.requestId = requestId;

    return next.handle().pipe(
      map((data) => {
        // Default values
        let message = 'Success';
        let pureData = data;

        // Extract custom message/data if wrapped in { message, data }
        if (
          data &&
          typeof data === 'object' &&
          'message' in data &&
          'data' in data
        ) {
          message = data.message;
          pureData = data.data;
        }

        // Determine if we are dealing with pagination
        const paginatedInfo =
          data instanceof PaginatedResponse
            ? data
            : pureData instanceof PaginatedResponse
              ? pureData
              : null;
        const isPaginated = !!paginatedInfo;

        const res: Response<T> = {
          status: response.statusCode,
          message: message,
          data: isPaginated ? (paginatedInfo.data as any) : pureData || {},
          meta: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
          },
        };

        if (isPaginated) {
          res.meta.pagination = {
            next_cursor: paginatedInfo.next_cursor,
            total_count: paginatedInfo.total_count,
            per_page: paginatedInfo.per_page,
            current_count: paginatedInfo.current_count,
            page: paginatedInfo.page,
            total_pages: paginatedInfo.total_pages,
          };
        }

        return res;
      }),
    );
  }
}
