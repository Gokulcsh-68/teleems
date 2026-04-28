import { NestFactory } from '@nestjs/core';
import { AdminServiceModule } from './admin-service.module';

async function bootstrap() {
  const app = await NestFactory.create(AdminServiceModule);

  // URL Normalization: Automatically fix double slash issues (e.g. //v1/admin -> /v1/admin)
  app.use((req: any, res: any, next: any) => {
    if (req.url.includes('//')) {
      req.url = req.url.replace(/\/\/+/g, '/');
    }
    next();
  });

  await app.listen(process.env.port ?? 3000);
}
bootstrap();
