import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BreakerOptions, CircuitBreaker } from "../shared/circuit-breaker";
import { clearInterval } from "timers";
import { DataSource, ObjectLiteral, EntityTarget, Repository } from "typeorm";
import { PinoLogger } from 'nestjs-pino';

/**
 *  backgroundInitialize() runs in background and keeps trying to connect on startup and after failures.

    startPoller() runs every 10s to SELECT 1. If the poll fails, we destroy() the DataSource (if initialized) and schedule re-initialization. This makes the service notice runtime DB outages.

    isInitialized() and checkConnection() are used by readiness endpoints.

    executeWithBreaker() lets you run any DB operation inside a circuit breaker. The breakers are configured once and keep state (open/closed).

    Breakers are generic: they expect the first argument to be a function to run, which is how genericExec in the constructor is written.
 */


function sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
    //private readonly logger = new Logger(DatabaseService.name);

    private dataSource: DataSource;
    private initialized = false;
    private initializing = false;
    private stopped = false;

    //background poll timer
    private pollTimer?: NodeJS.Timeout;

    // configure for retries/backoff
    private readonly maxAttempts = 10;
    private readonly baseDelayMs = 1000; //exponential backoff base (1s base)
    private readonly maxBackoffMs = 30_000;

    // Circuit breakers for read/write
    private readonly readBreaker: CircuitBreaker;
    private readonly writeBreaker: CircuitBreaker;
    private readonly breakerOpts: BreakerOptions = { failureThreshold: 5, successThreshold: 2, timeout: 2000, resetTimeout: 8000 };

    constructor(
        private readonly configService: ConfigService,
        private readonly logger: PinoLogger,
    ) {
        // create DataSource instance but DO NOT call initialize() yet
        this.dataSource = require('./app-data-source').createAppDataSource({
            host: this.configService.get<string>('DB_HOST'),
            port: this.configService.get<number>('DB_PORT'),
            username: this.configService.get<string>('DB_USERNAME'),
            password: this.configService.get<string>('DB_PASSWORD'),
            database: this.configService.get<string>('DB_DATABASE'),
            synchronize: this.configService.get<string>('STAGE') !== 'prod',
        });

        // Breaker functions are generic: they accept a function as first arg and run it.
        // This allows the breaker to be reused for arbitrary DB calls.
        const genericExec = async (fn: Function, ...args: any[]) => {
            // fn is expected to be an async function returning the DB result
            return fn(...args);
        };

        this.readBreaker = new CircuitBreaker(genericExec, this.breakerOpts);
        this.writeBreaker = new CircuitBreaker(genericExec, { ...this.breakerOpts, failureThreshold: 3, timeout: 3000});

        this.logger.setContext(DatabaseService.name);
    }

    async onModuleInit() {
        // start background initialization, do not await - app will continue to boot
        this.logger.info('Starting background DB initializer');
        this.backgroundInitialize().catch((err) => {
            // backgroundInitialize shoudn't bubble up - we log here for visibility
            this.logger.warn('Background DB initializer error: ' + err?.message);
        });

        this.startPoller();
    }

    async onModuleDestroy() {
        this.stopped = true;
        if (this.pollTimer) clearInterval(this.pollTimer);
        if (this.dataSource && this.dataSource.isInitialized) {
            await this.dataSource.destroy();
            this.logger.info('DataSource destroyed');
        }
    }

    private startPoller() {
        // poll every 30s; tune as required
        const pollIntervalMs = 30_000;
        this.pollTimer = setInterval(() => {
            this.pollDb().catch((err) => {
                // pollDb handles marking initialized=false and triggers re-init
                this.logger.debug('pollDb error: ' + (err?.message ?? err));
            });
        }, pollIntervalMs);
        //initial immediate poll (non-blocking)
        this.pollDb().catch(() => {});
    }

    private async pollDb() {
        // If not initialized, background initialize will be trying; but we can attempt a light check to keep readiness accurate
        if (!this.dataSource) return;

        try {
            //if dataSource is initialized, try a tiny query
            if (this.dataSource.isInitialized) {
                await this.dataSource.query('SELECT 1');
                // DB OK - ensure flags are accurate
                if (!this.initialized) {
                    this.initialized = true;
                    this.logger.info('DB poll: recovered - marked initialized = true');
                }
            }
        } catch (err: any) {
            // On failure: mark as not initialized and attempt to destroy dataSource so background initializer creates a fresh connection
            if (this.initialized) {
                this.logger.warn('DB poll failed while previously initialized - marking not initialized and attempting destroy: ' + (err?.message ?? err));
            } else {
                this.logger.debug('DB poll failed (not initialized yet): ' + (err?.message ?? err));
            }

            this.initialized = false;

            try {
                if (this.dataSource.isInitialized) {
                    // try to gracefully close existing connection before re-init
                    await this.dataSource.destroy();
                    this.logger.info('DataSource destroyed due to failed poll (will attempt re-initialize)');
                }
            } catch (destroyErr) {
                this.logger.warn('Error destroying DataSource after failed poll: '+ (destroyErr as any)?.message);
            }

            // ensure background intializer runs to re-establish connection
            this.backgroundInitialize().catch((e) => this.logger.warn('backgroundInitialize after poll error: '+ (e?.message ?? e)))
        }
    }

    private async backgroundInitialize() {
        if (this.initialized || this.initializing) return;
        this.initializing = true;
        let attempts = 0;

        // helper to produce jittered delay
        const jitter = (ms: number) => Math.floor(ms * (0.5 + Math.random() * 0.5));

        while (!this.initialized && !this.stopped) {
            attempts++;
            try {
            this.logger.info(`Attempting to initialize DB (attempt ${attempts})`);
            await this.dataSource.initialize();
            this.initialized = true;
            this.logger.info(`Database initialized successfully on attempt ${attempts}`);
            break;
            } catch (err: any) {
            // Helpful error extraction for AggregateError-like errors
            let details = '';
            if (typeof err === 'object' && 'errors' in err && Array.isArray((err as any).errors)) {
                // AggregateError: show inner error messages
                details = (err as any).errors.map((e: any, i: number) => `inner[${i}]: ${e?.message ?? String(e)}`).join('; ');
            } else {
                details = err?.message ?? String(err);
            }

            // also include stack for richer debugging (but avoid flooding production logs)
            const stack = err?.stack ? `\n${err.stack}` : '';

            this.logger.warn(`Database initialize attempt ${attempts} failed: ${details}${stack}`);

            // compute backoff with cap and jitter
            const rawDelay = Math.min(this.baseDelayMs * 2 ** attempts, this.maxBackoffMs);
            const delay = jitter(rawDelay);
            this.logger.debug(`Retrying in ${delay}ms`);

            // If you've retried many times, produce a summary log and reset attempts to avoid unbounded exponent growth
            if (attempts >= this.maxAttempts) {
                this.logger.warn(`DB still not available after ${attempts} attempts — continuing background retries (backoff capped).`);
                attempts = 0; // reset to avoid huge exponent growth
            }

            // wait before next attempt
            await sleep(delay);
            }
        }

        this.initializing = false;
        }

    isInitialized() {
        return this.initialized && this.dataSource.isInitialized;
    }

    // small utility to run a lightweight readiness check without throwing
    async checkConnection(): Promise<{ ok: boolean; error?: string }> {
        if(!this.isInitialized()) return { ok: false, error: 'not_initialized'};
        try {
            await this.dataSource.query('SELECT 1');
            return { ok: true }
        } catch (err) {
            return { ok: false, error: (err as any).message || String(err) };
        }
    }

    // get repository or throw (caller should catch and respond with 503)
    getRepository<Entity extends ObjectLiteral>(entity: EntityTarget<Entity>): Repository<Entity> {
        if (!this.isInitialized()) {
            throw new Error('Database not initialized');
        }
        return this.dataSource.getRepository<Entity>(entity);
    }

    // return raw DataSource if needed (but check isInitialized first)
    getDataSource() {
        if (!this.isInitialized()) throw new Error('Database not initialized');
        return this.dataSource;
    }

    //execute arbitrary DB operation under a circuit breaker
    // kind: 'read' | 'write' chooses different breaker sensitivity
    async executeWithBreaker<T>(fn: (...args: any[]) => Promise<T>, kind: 'read' | 'write' = 'read'): Promise<T> {
        if (!this.isInitialized()) {
            throw new Error('Database not initialized');
        }

        const breaker = kind === 'write' ? this.writeBreaker : this.readBreaker;
        // fire the breaker, passing the function as first arg (genericExec in ctor will call fn)
        // note: we don't pass args here; if needed, wrap fn to include args
        try {
            return await breaker.fire(fn);
        } catch (err) {
            // if breaker is open it throws; propagate so callers can return 503
            throw err;
        }
    }

    getBreakerStatuses() {
        const read = (this as any).readBreaker?.status?.() ?? null;
        const write = (this as any).writeBreaker?.status?.() ?? null;
        return { read, write };
    }
    
}