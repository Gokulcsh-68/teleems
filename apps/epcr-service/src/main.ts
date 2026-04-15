import { NestFactory } from '@nestjs/core';
import { EpcrServiceModule } from './epcr-service.module';

async function bootstrap() {
  const app = await NestFactory.create(EpcrServiceModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
