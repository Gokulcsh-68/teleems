import { NestFactory } from '@nestjs/core';
import { FleetServiceModule } from './fleet-service.module';

async function bootstrap() {
  const app = await NestFactory.create(FleetServiceModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
