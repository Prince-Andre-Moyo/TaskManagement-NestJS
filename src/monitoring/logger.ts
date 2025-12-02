import { Params } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import * as pino from 'pino';

export const createLoggerOptions = (config: ConfigService): Params => {
  const stage = config.get<string>('STAGE', 'dev');
  const isProd = stage === 'prod';
  const level = config.get<string>('LOG_LEVEL', isProd ? 'info' : 'debug');

  const transport = !isProd
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined;

  return {
    pinoHttp: {
      level,
      transport,
      serializers: (pino as any).stdSerializers,
      // redact typical sensitive fields by default; adjust as needed
      redact: ['req.headers.authorization', 'res.headers["set-cookie"]', 'password'],
    },
  };
};
