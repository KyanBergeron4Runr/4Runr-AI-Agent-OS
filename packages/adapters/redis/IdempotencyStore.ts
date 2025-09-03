import { IdempotencyKey } from '../../middleware/idempotency/idempotency';

// Interface for the Redis store adapter
export interface IdempotencyStore {
  get(key: string, tenant: string, route: string): Promise<IdempotencyKey | null>;
  set(key: string, tenant: string, route: string, bodyHash: string, response: {
    statusCode: number;
    body: any;
    headers?: Record<string, string>;
  }): Promise<void>;
  delete(key: string, tenant: string, route: string): Promise<void>;
  cleanup(): Promise<void>;
}

// Redis-based implementation
export class RedisIdempotencyStore implements IdempotencyStore {
  private redis: any; // Redis client
  private ttlSeconds: number;
  private prefix: string;

  constructor(redisClient: any, ttlSeconds: number = 86400, prefix: string = 'idempotency') {
    this.redis = redisClient;
    this.ttlSeconds = ttlSeconds;
    this.prefix = prefix;
  }

  private getKey(idempotencyKey: string, tenant: string, route: string): string {
    return `${this.prefix}:${tenant}:${route}:${idempotencyKey}`;
  }

  async get(key: string, tenant: string, route: string): Promise<IdempotencyKey | null> {
    try {
      const redisKey = this.getKey(key, tenant, route);
      const data = await this.redis.get(redisKey);
      
      if (!data) {
        return null;
      }

      const parsed = JSON.parse(data);
      
      // Check if expired
      if (new Date(parsed.expiresAt) < new Date()) {
        await this.delete(key, tenant, route);
        return null;
      }

      return {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
        expiresAt: new Date(parsed.expiresAt)
      };
    } catch (error) {
      console.error('Error getting idempotency key:', error);
      return null;
    }
  }

  async set(
    key: string, 
    tenant: string, 
    route: string, 
    bodyHash: string, 
    response: {
      statusCode: number;
      body: any;
      headers?: Record<string, string>;
    }
  ): Promise<void> {
    try {
      const redisKey = this.getKey(key, tenant, route);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.ttlSeconds * 1000);

      const data: IdempotencyKey = {
        key,
        tenant,
        route,
        bodyHash,
        response: response.body,
        statusCode: response.statusCode,
        headers: response.headers || {},
        createdAt: now,
        expiresAt
      };

      await this.redis.setex(
        redisKey,
        this.ttlSeconds,
        JSON.stringify(data)
      );
    } catch (error) {
      console.error('Error setting idempotency key:', error);
      // Don't throw - idempotency failure shouldn't break the request
    }
  }

  async delete(key: string, tenant: string, route: string): Promise<void> {
    try {
      const redisKey = this.getKey(key, tenant, route);
      await this.redis.del(redisKey);
    } catch (error) {
      console.error('Error deleting idempotency key:', error);
    }
  }

  async cleanup(): Promise<void> {
    try {
      // This would typically be handled by Redis TTL, but we can add manual cleanup
      // For now, just log that cleanup was requested
      console.log('Idempotency cleanup requested - Redis TTL handles expiration automatically');
    } catch (error) {
      console.error('Error during idempotency cleanup:', error);
    }
  }
}

// In-memory fallback implementation for testing/development
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private store = new Map<string, IdempotencyKey>();
  private ttlSeconds: number;

  constructor(ttlSeconds: number = 86400) {
    this.ttlSeconds = ttlSeconds;
  }

  private getKey(idempotencyKey: string, tenant: string, route: string): string {
    return `${tenant}:${route}:${idempotencyKey}`;
  }

  async get(key: string, tenant: string, route: string): Promise<IdempotencyKey | null> {
    const storeKey = this.getKey(key, tenant, route);
    const data = this.store.get(storeKey);
    
    if (!data) {
      return null;
    }

    // Check if expired
    if (data.expiresAt < new Date()) {
      this.store.delete(storeKey);
      return null;
    }

    return data;
  }

  async set(
    key: string, 
    tenant: string, 
    route: string, 
    bodyHash: string, 
    response: {
      statusCode: number;
      body: any;
      headers?: Record<string, string>;
    }
  ): Promise<void> {
    const storeKey = this.getKey(key, tenant, route);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttlSeconds * 1000);

    const data: IdempotencyKey = {
      key,
      tenant,
      route,
      bodyHash,
      response: response.body,
      statusCode: response.statusCode,
      headers: response.headers || {},
      createdAt: now,
      expiresAt
    };

    this.store.set(storeKey, data);
  }

  async delete(key: string, tenant: string, route: string): Promise<void> {
    const storeKey = this.getKey(key, tenant, route);
    this.store.delete(storeKey);
  }

  async cleanup(): Promise<void> {
    const now = new Date();
    for (const [key, value] of this.store.entries()) {
      if (value.expiresAt < now) {
        this.store.delete(key);
      }
    }
  }
}
