"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitManager = exports.RATE_LIMITS = exports.RateLimitManager = void 0;
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
class RateLimitManager {
    constructor(useRedis = false, redisClient) {
        this.useRedis = useRedis;
        this.redisClient = redisClient;
        this.limiters = new Map();
    }
    // Create or get rate limiter for a specific key
    getLimiter(key, config) {
        if (!this.limiters.has(key)) {
            const limiter = this.useRedis && this.redisClient
                ? new rate_limiter_flexible_1.RateLimiterRedis({
                    storeClient: this.redisClient,
                    keyPrefix: `rl_${key}`,
                    points: config.points,
                    duration: config.duration,
                    blockDuration: config.blockDuration,
                })
                : new rate_limiter_flexible_1.RateLimiterMemory({
                    keyPrefix: `rl_${key}`,
                    points: config.points,
                    duration: config.duration,
                    blockDuration: config.blockDuration,
                });
            this.limiters.set(key, limiter);
        }
        return this.limiters.get(key);
    }
    // Check if request is allowed
    async checkLimit(key, identifier, config) {
        const limiter = this.getLimiter(key, config);
        try {
            await limiter.consume(identifier);
            return true;
        }
        catch (rejRes) {
            return false;
        }
    }
    // Get remaining points for identifier
    async getRemaining(key, identifier, config) {
        const limiter = this.getLimiter(key, config);
        try {
            const res = await limiter.get(identifier);
            // Note: property name might vary by version, using basic calculation
            const consumed = res.totalHits || res.consumedPoints || 0;
            return Math.max(0, config.points - consumed);
        }
        catch {
            return config.points;
        }
    }
}
exports.RateLimitManager = RateLimitManager;
// Rate limit configurations
exports.RATE_LIMITS = {
    // Global rate limiting
    GLOBAL: {
        points: 1000, // 1000 requests
        duration: 60, // per minute
        blockDuration: 60 // block for 1 minute
    },
    // Per-IP rate limiting
    PER_IP: {
        points: 100, // 100 requests
        duration: 60, // per minute
        blockDuration: 300 // block for 5 minutes
    },
    // Health endpoint (more lenient)
    HEALTH: {
        points: 300, // 300 requests
        duration: 60, // per minute  
        blockDuration: 60 // block for 1 minute
    },
    // API endpoints (stricter)
    API: {
        points: 50, // 50 requests
        duration: 60, // per minute
        blockDuration: 600 // block for 10 minutes
    }
};
exports.rateLimitManager = new RateLimitManager();
//# sourceMappingURL=rate-limiter.js.map