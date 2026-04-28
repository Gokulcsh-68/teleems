import { NestFactory } from '@nestjs/core';
import { PatientServiceModule } from './patient-service.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(PatientServiceModule);

  // Port 3010 for Patient Service
  const port = process.env.PORT || 3010;

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(port);
  console.log(`Patient Service is running on: http://localhost:${port}`);
}
bootstrap();
