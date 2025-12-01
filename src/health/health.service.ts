import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class HealthService {
    constructor(private readonly databaseService: DatabaseService) {}

    // liveness: process-level quick check
    liveness() {
        return { status: 'live', timestamp: new Date().toISOString() };
    }

    // readiness: ask DatabaseService for a quick connection check
    async readiness() {
        // checkConnection returns { ok: boolean, error?: string }
        return await this.databaseService.checkConnection();
    }

    // advanced: aggregate extra info for ops (breaker states, initialized flag, last check)
    // This relies on DatabaseService exposing getBreakerStatuses() and isInitialized()
    advanced(){
        const initialized = this.databaseService.isInitialized();
        const breakers = this.databaseService.getBreakerStatuses?.() ?? null;
        return {
            initialized,
            breakers,
            timestamp: new Date().toISOString(),
        }
    }
}
