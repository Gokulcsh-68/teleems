import { NestFactory } from '@nestjs/core';
import { TelelinkServiceModule } from './telelink-service.module';

async function bootstrap() {
  const app = await NestFactory.create(TelelinkServiceModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
