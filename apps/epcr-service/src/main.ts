import { NestFactory } from '@nestjs/core';
import { EpcrServiceModule } from './epcr-service.module';

async function bootstrap() {
  const app = await NestFactory.create(EpcrServiceModule);
  await app.listen(process.env.PORT || 3005);
}
bootstrap();
