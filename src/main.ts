import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { TransformInterceptor } from './transform.interceptor';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN') || true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // strip props that are not in DTOs
      transform: true,            // transform payloads to DTO instances
      forbidNonWhitelisted: false // true if you want to reject unknown props
  }));
  
  app.useGlobalInterceptors(new TransformInterceptor());

  await app.listen(port);
  logger.log(`Application listening on port ${port}`);
}
bootstrap();
