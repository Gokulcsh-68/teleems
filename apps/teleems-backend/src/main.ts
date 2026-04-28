import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { ResponseInterceptor } from '../../../libs/common/src/interceptors/response.interceptor';
import { AllExceptionsFilter } from '../../../libs/common/src/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global Middleware
  app.use(cookieParser());

  // URL Normalization: Automatically fix double slash issues (e.g. //v1/auth -> /v1/auth)
  app.use((req: any, res: any, next: any) => {
    if (req.url && req.url.includes('//')) {
      req.url = req.url.replace(/\/\/+/g, '/');
    }
    if (req.originalUrl && req.originalUrl.includes('//')) {
      req.originalUrl = req.originalUrl.replace(/\/\/+/g, '/');
    }
    next();
  });

  // Global Pipes & Interceptors
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // Enable CORS for frontend integration
  app.enableCors({
    origin: true, // In production, replace with specific domain
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Unified API is running on: http://localhost:${port}`);
}
bootstrap();
