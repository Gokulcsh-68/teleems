import { NestFactory } from '@nestjs/core';
import { RtvsServiceModule } from './rtvs-service.module';

async function bootstrap() {
  const app = await NestFactory.create(RtvsServiceModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
