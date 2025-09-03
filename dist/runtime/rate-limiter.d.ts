import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
export interface RateLimitConfig {
    points: number;
    duration: number;
    blockDuration: number;
}
export declare class RateLimitManager {
    private useRedis;
    private redisClient?;
    private limiters;
    constructor(useRedis?: boolean, redisClient?: any | undefined);
    getLimiter(key: string, config: RateLimitConfig): RateLimiterMemory | RateLimiterRedis;
    checkLimit(key: string, identifier: string, config: RateLimitConfig): Promise<boolean>;
    getRemaining(key: string, identifier: string, config: RateLimitConfig): Promise<number>;
}
export declare const RATE_LIMITS: {
    GLOBAL: {
        points: number;
        duration: number;
        blockDuration: number;
    };
    PER_IP: {
        points: number;
        duration: number;
        blockDuration: number;
    };
    HEALTH: {
        points: number;
        duration: number;
        blockDuration: number;
    };
    API: {
        points: number;
        duration: number;
        blockDuration: number;
    };
};
export declare const rateLimitManager: RateLimitManager;
//# sourceMappingURL=rate-limiter.d.ts.map