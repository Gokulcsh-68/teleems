import { NestFactory } from '@nestjs/core';
import { FleetServiceModule } from './fleet-service.module';

async function bootstrap() {
  const app = await NestFactory.create(FleetServiceModule);

  // URL Normalization: Automatically fix double slash issues (e.g. //v1/fleet -> /v1/fleet)
  app.use((req: any, res: any, next: any) => {
    if (req.url.includes('//')) {
      req.url = req.url.replace(/\/\/+/g, '/');
    }
    next();
  });

  await app.listen(process.env.port ?? 3100);
}
bootstrap();
