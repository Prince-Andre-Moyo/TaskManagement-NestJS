import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TasksModule } from './tasks/tasks.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { configValidationSchema } from './config.schema';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { LoggerModule } from 'nestjs-pino';
import { createLoggerOptions } from './monitoring/logger';
import { RequestIdMiddleware } from './shared/middleware/request-id.middleware';


@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [`.env.stage.${process.env.STAGE}`],
      validationSchema: configValidationSchema,
      isGlobal: true,
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => createLoggerOptions(configService),
    }),
    TasksModule,
    DatabaseModule,
    AuthModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // apply to all routes (order matters: middleware runs before pino-http handler)
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
