import { NestFactory } from '@nestjs/core';
import { ApiGatewayModule } from './api-gateway.module';
import { createProxyMiddleware } from 'http-proxy-middleware';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);

  // URL Normalization: Automatically fix double slash issues (e.g. //v1/auth -> /v1/auth)
  app.use((req: any, res: any, next: any) => {
    if (req.url && req.url.includes('//')) {
      req.url = req.url.replace(/\/\/+/g, '/');
    }
    if (req.originalUrl && req.originalUrl.includes('//')) {
      req.originalUrl = req.originalUrl.replace(/\/\/+/g, '/');
    }
    next();
  });

  const ensureHttp = (url: string) =>
    url.startsWith('http') ? url : `http://${url}`;

  const authUrl = ensureHttp(
    process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  );
  const dispatchUrl = ensureHttp(
    process.env.DISPATCH_SERVICE_URL || 'http://localhost:3002',
  );

  const patientUrl = ensureHttp(
    process.env.PATIENT_SERVICE_URL || 'http://localhost:3010',
  );
  const rtvsUrl = ensureHttp(
    process.env.RTVS_SERVICE_URL || 'http://localhost:3003',
  );
  const epcrUrl = ensureHttp(
    process.env.EPCR_SERVICE_URL || 'http://localhost:3005',
  );

  const rewriteSlashes = (path: string) => path.replace(/\/\/+/g, '/');

  // Proxy for Auth Service
  app.use(
    ['/v1/auth', '//v1/auth'],
    createProxyMiddleware({
      target: authUrl,
      changeOrigin: true,
      pathRewrite: rewriteSlashes,
    }),
  );
 
  // Proxy for RTVS Service
  app.use(
    ['/v1/rtvs', '//v1/rtvs'],
    createProxyMiddleware({
      target: rtvsUrl,
      changeOrigin: true,
      pathRewrite: rewriteSlashes,
    }),
  );

  // Proxy for Dispatch Service
  app.use(
    ['/v1/incidents', '//v1/incidents'],
    createProxyMiddleware({
      target: dispatchUrl,
      changeOrigin: true,
      pathRewrite: rewriteSlashes,
    }),
  );

  // Proxy for Patient Service
  app.use(
    ['/v1/patients', '//v1/patients'],
    createProxyMiddleware({
      target: patientUrl,
      changeOrigin: true,
      pathRewrite: rewriteSlashes,
    }),
  );

  app.use(
    ['/v1/trips', '//v1/trips'],
    createProxyMiddleware({
      target: dispatchUrl,
      changeOrigin: true,
      pathRewrite: rewriteSlashes,
    }),
  );

  // Proxy for ePCR Service
  app.use(
    ['/v1/epcr', '//v1/epcr'],
    createProxyMiddleware({
      target: epcrUrl,
      changeOrigin: true,
      pathRewrite: rewriteSlashes,
    }),
  );

  // You can easily scale this to other microservices:
  // '/v1/users' -> UserService
  // '/v1/fleet' -> FleetService

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
