import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';

@Injectable()
export class DynamicRateLimitGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    if (req.user && req.user.userId) {
      return req.user.userId;
    }
    return req.ips?.length ? req.ips[0] : req.ip;
  }

  // Override handleRequest to inject dynamic limits based on 1.4 specs
  protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context, throttler } = requestProps;
    const req = context.switchToHttp().getRequest();
    const url = req.url || '';
    
    // Default Unauthenticated Limits
    let targetLimit = 100;
    let targetTtl = 60000; 

    if (url.includes('otp/request')) {
      targetLimit = 5;
      targetTtl = 60000;
    } else if (url.includes('telelink/session')) {
      targetLimit = 10;
      targetTtl = 60000; 
    } else if (req.user) {
      if (req.user.role === 'SYSTEM') {
        targetLimit = 10000;
        targetTtl = 60000;
      } else {
        targetLimit = 1000;
        targetTtl = 60000;
      }
    }

    // Assign dynamic values to the request props
    requestProps.limit = targetLimit;
    requestProps.ttl = targetTtl;

    return super.handleRequest(requestProps);
  }
}
