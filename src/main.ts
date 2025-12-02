import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from './transform.interceptor';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerDocumentOptions, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

async function bootstrap() {

  //const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  const logger = app.get(Logger);

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

  const config = new DocumentBuilder()
    .setTitle('Task-Management-App')
    .setDescription('Endpoints for Authentication and Tasks')
    .setVersion('1.0')
    .addTag('Endpoints')
    .addBearerAuth()
    .build();

  // For example, if you want to make sure that the library generates operation names like 
  // createUser instead of UsersController_createUser, you can set the following:
  const options: SwaggerDocumentOptions = {
    operationIdFactory: (
      controllerKey: string,
      methodKey: string
    ) => methodKey
  };
  
  const documentFactory = () => SwaggerModule.createDocument(app, config, options);

  SwaggerModule.setup('swagger-ui', app, documentFactory, {
    jsonDocumentUrl: 'swagger/json',
  });

  await app.listen(port);

  logger.log(`Application listening on port ${port}`);

}

bootstrap().catch(err => {
  // If app fails to start, try to log with console as fallback (logger may not be initialized)
  // but if logger exists, use it:
  try {
    const fallbackLogger = (global as any).logger;
    if (fallbackLogger?.error) {
      fallbackLogger.error('Bootstrap failed: ' + (err?.stack || err));
    }
  } catch {}
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
