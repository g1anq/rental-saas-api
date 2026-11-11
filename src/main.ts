import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module.js';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { rateLimit } from 'express-rate-limit';
import * as express from 'express';
import { getCorsOrigins, validateProductionSecurity } from './config/cors-origins.js';
import { getAuthCookieToken } from './auth/auth-cookie.js';

async function bootstrap() {
  validateProductionSecurity();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const corsOrigins = getCorsOrigins();
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }

  app.use(
    '/auth',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        message: 'Quá nhiều yêu cầu xác thực. Vui lòng thử lại sau 15 phút.',
      },
    }),
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Cấu hình CORS để NextJS (Frontend) có thể gọi được API
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.use((request: Request, response: Response, next: NextFunction) => {
    const isSafeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    const origin = request.get('origin');
    const hasAuthCookie = Boolean(getAuthCookieToken(request.headers.cookie));

    if (isSafeMethod || (origin && corsOrigins.includes(origin)) || (!origin && !hasAuthCookie)) {
      next();
      return;
    }

    response.status(403).json({ message: 'Origin không được phép thực hiện yêu cầu này.' });
  });

  // Bật ValidationPipe toàn cục — validate DTO tự động
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  // Cấu hình Swagger
  const config = new DocumentBuilder()
    .setTitle('Rental SaaS API')
    .setDescription('Tài liệu API cho Đồ án Quản lý nhà trọ')
    .setVersion('1.0')
    .addBearerAuth() // Dùng cho phần JWT Login sau này
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(3001);
  console.log('API đang chạy tại: http://localhost:3001');
  console.log('Swagger UI tại: http://localhost:3001/api/docs');
}
bootstrap();
