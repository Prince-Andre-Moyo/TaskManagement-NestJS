import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { TransformInterceptor } from './transform.interceptor';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerDocumentOptions, SwaggerModule } from '@nestjs/swagger';

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
bootstrap();
