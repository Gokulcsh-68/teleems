import { NestFactory } from '@nestjs/core';
import { TelelinkServiceModule } from './telelink-service.module';

async function bootstrap() {
  const app = await NestFactory.create(TelelinkServiceModule);
  const port = process.env.PORT ?? 3004;
  await app.listen(port, '0.0.0.0');
}
bootstrap();

