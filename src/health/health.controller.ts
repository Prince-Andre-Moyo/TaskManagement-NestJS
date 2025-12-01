import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
    constructor(private readonly healthService: HealthService) {}

    @Get('liveness')
    liveness() {
        return this.healthService.liveness();
    }

    @Get('readiness')
    async readiness() {
        const st = await this.healthService.readiness();
        if(!st.ok){
            // return 503 so orchestrators/loadbalancers mark pod as not ready
            throw new HttpException({ status: 'not_ready', db: st }, HttpStatus.SERVICE_UNAVAILABLE);
        }
        return { status: 'ready', db: st };
    }

    // optional admin-only endpoint (you should restrict access by network or auth in prod)
    @Get('advanced')
    advanced() {
        // This endpoint is intended for operators and may contain internal state.
        // Make sure it's protected by network policy, API key, or only exposed on an admin path.
        return this.healthService.advanced();
    }
}
