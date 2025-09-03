import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';

export interface RateLimitConfig {
  points: number;     // Number of requests
  duration: number;   // Per time period in seconds
  blockDuration: number; // Block duration in seconds
}

export class RateLimitManager {
  private limiters: Map<string, RateLimiterMemory | RateLimiterRedis> = new Map();

  constructor(private useRedis = false, private redisClient?: any) {}

  // Create or get rate limiter for a specific key
  getLimiter(key: string, config: RateLimitConfig): RateLimiterMemory | RateLimiterRedis {
    if (!this.limiters.has(key)) {
      const limiter = this.useRedis && this.redisClient
        ? new RateLimiterRedis({
            storeClient: this.redisClient,
            keyPrefix: `rl_${key}`,
            points: config.points,
            duration: config.duration,
            blockDuration: config.blockDuration,
          })
        : new RateLimiterMemory({
            keyPrefix: `rl_${key}`,
            points: config.points,
            duration: config.duration,
            blockDuration: config.blockDuration,
          });

      this.limiters.set(key, limiter);
    }

    return this.limiters.get(key)!;
  }

  // Check if request is allowed
  async checkLimit(key: string, identifier: string, config: RateLimitConfig): Promise<boolean> {
    const limiter = this.getLimiter(key, config);
    
    try {
      await limiter.consume(identifier);
      return true;
    } catch (rejRes) {
      return false;
    }
  }

  // Get remaining points for identifier
  async getRemaining(key: string, identifier: string, config: RateLimitConfig): Promise<number> {
    const limiter = this.getLimiter(key, config);
    
    try {
      const res = await limiter.get(identifier);
      // Note: property name might vary by version, using basic calculation
      const consumed = (res as any).totalHits || (res as any).consumedPoints || 0;
      return Math.max(0, config.points - consumed);
    } catch {
      return config.points;
    }
  }
}

// Rate limit configurations
export const RATE_LIMITS = {
  // Global rate limiting
  GLOBAL: {
    points: 1000,        // 1000 requests
    duration: 60,        // per minute
    blockDuration: 60    // block for 1 minute
  },
  
  // Per-IP rate limiting
  PER_IP: {
    points: 100,         // 100 requests
    duration: 60,        // per minute
    blockDuration: 300   // block for 5 minutes
  },
  
  // Health endpoint (more lenient)
  HEALTH: {
    points: 300,         // 300 requests
    duration: 60,        // per minute  
    blockDuration: 60    // block for 1 minute
  },
  
  // API endpoints (stricter)
  API: {
    points: 50,          // 50 requests
    duration: 60,        // per minute
    blockDuration: 600   // block for 10 minutes
  }
};

export const rateLimitManager = new RateLimitManager();
