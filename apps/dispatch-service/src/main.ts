import { NestFactory } from '@nestjs/core';
import { DispatchServiceModule } from './dispatch-service.module';

import { ValidationPipe } from '@nestjs/common';
import { ResponseInterceptor } from '../../../libs/common/src/interceptors/response.interceptor';
import { AllExceptionsFilter } from '../../../libs/common/src/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(DispatchServiceModule);

  // URL Normalization: Automatically fix double slash issues (e.g. //v1/dispatch -> /v1/dispatch)
  app.use((req: any, res: any, next: any) => {
    if (req.url.includes('//')) {
      req.url = req.url.replace(/\/\/+/g, '/');
    }
    next();
  });
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  
  await app.listen(process.env.DISPATCH_PORT ?? 3002);
}
bootstrap();
