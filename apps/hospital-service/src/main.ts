import { NestFactory } from '@nestjs/core';
import { HospitalServiceModule } from './hospital-service.module';

async function bootstrap() {
  const app = await NestFactory.create(HospitalServiceModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
