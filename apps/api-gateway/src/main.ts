import { NestFactory } from '@nestjs/core';
import { ApiGatewayModule } from './api-gateway.module';
import { createProxyMiddleware } from 'http-proxy-middleware';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);
  
  const ensureHttp = (url: string) => url.startsWith('http') ? url : `http://${url}`;
  
  const authUrl = ensureHttp(process.env.AUTH_SERVICE_URL || 'http://localhost:3001');
  const dispatchUrl = ensureHttp(process.env.DISPATCH_SERVICE_URL || 'http://localhost:3002');
  
  // Proxy for Auth Service
  app.use(
    '/v1/auth',
    createProxyMiddleware({
      target: authUrl,
      changeOrigin: true,
    }),
  );

  // Proxy for Dispatch Service
  app.use(
    '/v1/incidents',
    createProxyMiddleware({
      target: dispatchUrl,
      changeOrigin: true,
    }),
  );

  // Proxy for Patient Service (Integrated in Dispatch Service)
  app.use(
    '/v1/patients',
    createProxyMiddleware({
      target: dispatchUrl,
      changeOrigin: true,
    }),
  );

  // Proxy for Trip Service (Integrated in Dispatch Service)
  app.use(
    '/v1/trips',
    createProxyMiddleware({
      target: dispatchUrl,
      changeOrigin: true,
    }),
  );

  // You can easily scale this to other microservices:
  // '/v1/users' -> UserService
  // '/v1/fleet' -> FleetService

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
