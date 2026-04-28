import { NestFactory } from '@nestjs/core';
import { RtvsServiceModule } from './rtvs-service.module';

async function bootstrap() {
  const app = await NestFactory.create(RtvsServiceModule);

  app.enableCors();
  app.setGlobalPrefix('v1');

  const port = 3003;
  await app.listen(port);
  console.log(`RTVS Service is running on: http://localhost:${port}/v1`);
  console.log(`WebSocket Gateway is live on: ws://localhost:${port}/rtvs`);
}
bootstrap();
