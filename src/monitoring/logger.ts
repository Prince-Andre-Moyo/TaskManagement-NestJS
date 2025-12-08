import { Params } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import * as pino from 'pino';
import { randomUUID } from 'crypto';

export const createLoggerOptions = (config: ConfigService): Params => {
  const stage = config.get<string>('STAGE', 'dev');
  const isProd = stage === 'prod';
  const level = config.get<string>('LOG_LEVEL', isProd ? 'info' : 'debug');

  return {
    pinoHttp: {
      level,
      // Use a pre-existing req.id (set by middleware) or incoming header; else generate.
      genReqId: (req: any) => {
        const header =
          (req.headers && (req.headers['x-request-id'] || req.headers['x-correlation-id'] || req.headers['x_correlation_id'])) ??
          undefined;

        if (header) return header;
        if (req.id) return req.id;
        if (typeof (global as any).crypto?.randomUUID === 'function') return (global as any).crypto.randomUUID();
        if (typeof randomUUID === 'function') return randomUUID();
        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      },

      // Add the request id as a custom prop so it's present in Logs under `requestId`
      customProps: (req: any, res: any) => {
        // pino-http will already include reqId internally (default key 'reqId),
        // but adding requestId explicitly can make queries easier (and human readable).
        return {
          requestId: req.id ?? req.headers?.['x-request-id'] ?? undefined,
        };
      },

      // pretty in dev, JSON in prod
      transport: !isProd
        ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
        : undefined,

      serializers: (pino as any).stdSerializers,

      // redact common sensitive headers
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    },
  };
};
