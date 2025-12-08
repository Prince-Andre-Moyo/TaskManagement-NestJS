import { Injectable, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
    use(req: Request & { id?: string }, res: Response, next: NextFunction) {
        // accept common incoming headers, prefer existing id if provided
        const header = 
            (req.headers['x-request-id'] as string | undefined) ??
            (req.headers['x-correlation-id'] as string | undefined) ??
            (req.headers['x_correlation_id'] as string | undefined);
        
        const id =
            header ||
            // Node's crypto.randomUUID() if available, fallback to a compact random id
            (typeof (global as any).crypto?.randomUUID === 'function'
            ? (global as any).crypto.randomUUID()
            : typeof randomUUID === 'function'
            ? randomUUID()
            : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
        
        // attach to req so pino-http genReqId can pick it up
        req.id = id;

        // expose to clients
        res.setHeader('X-Request-Id', id);
        next();
    }
}
