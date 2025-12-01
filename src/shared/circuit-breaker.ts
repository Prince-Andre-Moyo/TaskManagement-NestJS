// simple circuit breaker for Node/TypeScript
// usage:
// const cb = new CircuitBreaker(genericExec, opts);
// await cb.fire(someFn); // genericExec will call someFn()

/**
 * This circuit breaker is generic, meaning it can wrap any external dependency your API calls:

  Database (Postgres, MongoDB, Redis, etc.)
  External REST APIs (Stripe, Weather API, Payment provider)
  Internal microservices
  Message brokers (RabbitMQ, Kafka)
  File storage services (S3, Google Cloud Storage)
 */

export type BreakerOptions = {
    failureThreshold?: number; //failures to open
    successThreshold?: number; //success to close when half-open
    timeout?: number; //ms for operation timeout
    resetTimeout?: number; //ms to wait before trying half-open
};

export class CircuitBreaker {
    private failureCount = 0;
    private successCount = 0;
    private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
    private nextAttempt = 0; // timestamp in ms

    private opts: Required<BreakerOptions>;

    constructor(
        // fn is a generic executor function. In our DatabaseService we pass an executor
        // that will call the actual DB function passed to fire().
        private readonly fn: (...args: any[]) => Promise<any>,
        opts: BreakerOptions = {},
    ){
        this.opts = Object.assign(
            { failureThreshold: 5, successThreshold: 2, timeout: 3000, resetTimeout: 10000 },
            opts,
        );
    }

    private now() {
        return Date.now();
    }

    private timeoutPromise<T>(p: Promise<T>, ms: number){
        return new Promise<T>((resolve, reject) => {
            const t = setTimeout(() => reject(new Error('Operation timed out')), ms);
            p.then((r) => { clearTimeout(t); resolve(r); }).catch((e) => { clearTimeout(t); reject(e); });
        });
    }

    /**
   * Fire the breaker.
   * - If the breaker was constructed with a generic executor `exec`,
   *   call `exec(...args)`. e.g. exec = (fn) => fn()
   * - If the breaker is OPEN it will throw immediately (unless resetTimeout passed)
   */

    public async fire(...args: any[]) {
        if (this.state === 'OPEN') {
            if (this.now() > this.nextAttempt) {
                // allow a probe attempt
                this.state = 'HALF_OPEN';
            } else {
                throw new CircuitOpenError();;
            }
        }

        try {
            // call executor with args under a timeout
            const promise = Promise.resolve(this.fn(...args));
            const result = await this.timeoutPromise(promise, this.opts.timeout);
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private onSuccess() {
        if (this.state === 'HALF_OPEN') {
            this.successCount++;
            if (this.successCount >= this.opts.successThreshold) {
                this.close();
            }
        } else {
            // closed => reset failure count
            this.failureCount = 0;
        }
    }

    private onFailure() {
        this.failureCount++;
        if (this.failureCount >= this.opts.failureThreshold) {
            this.open();
        }
    }

    private open() {
        this.state = 'OPEN';
        this.nextAttempt = this.now() + this.opts.resetTimeout;
        this.failureCount = 0;
        this.successCount = 0;
    }

    private close() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = 0;
    }

    public status() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            nextAttempt: this.nextAttempt,
        };
    }
}

class CircuitOpenError extends Error { constructor(){ super('CircuitBreaker: OPEN'); this.name = 'CircuitOpenError'; } }