import { FastifyInstance } from 'fastify';
import { createIdempotencyMiddleware, captureIdempotencyResponse } from '../../middleware/idempotency/idempotency';
import { IdempotencyStore } from '../redis/IdempotencyStore';

// Gateway idempotency adapter - wires idempotency middleware to existing routes
export class GatewayIdempotencyAdapter {
  private fastify: FastifyInstance;
  private enabled: boolean;
  private ttlSeconds: number;
  private store: IdempotencyStore;

  constructor(
    fastify: FastifyInstance, 
    store: IdempotencyStore,
    enabled: boolean = false,
    ttlSeconds: number = 86400
  ) {
    this.fastify = fastify;
    this.store = store;
    this.enabled = enabled;
    this.ttlSeconds = ttlSeconds;
  }

  // Register idempotency middleware for run creation
  registerRunCreateIdempotency(): void {
    if (!this.enabled) {
      return; // Skip if idempotency is disabled
    }

    const idempotencyMiddleware = createIdempotencyMiddleware({
      enabled: this.enabled,
      ttlSeconds: this.ttlSeconds,
      store: this.store
    });

    // Add idempotency check as preHandler hook
    this.fastify.addHook('preHandler', async (request, reply) => {
      // Only apply to POST /api/runs
      if (request.method === 'POST' && request.routerPath === '/api/runs') {
        await idempotencyMiddleware(request, reply);
      }
    });

    // Add response capture as onSend hook
    this.fastify.addHook('onSend', async (request, reply, payload) => {
      // Only apply to POST /api/runs
      if (request.method === 'POST' && request.routerPath === '/api/runs') {
        return await captureIdempotencyResponse(request, reply, payload);
      }
      return payload;
    });
  }

  // Register idempotency for other endpoints (future expansion)
  registerEndpointIdempotency(endpoint: string): void {
    if (!this.enabled) {
      return;
    }

    const idempotencyMiddleware = createIdempotencyMiddleware({
      enabled: this.enabled,
      ttlSeconds: this.ttlSeconds,
      store: this.store
    });

    // Add idempotency check as preHandler hook
    this.fastify.addHook('preHandler', async (request, reply) => {
      if (request.routerPath === endpoint) {
        await idempotencyMiddleware(request, reply);
      }
    });

    // Add response capture as onSend hook
    this.fastify.addHook('onSend', async (request, reply, payload) => {
      if (request.routerPath === endpoint) {
        return await captureIdempotencyResponse(request, reply, payload);
      }
      return payload;
    });
  }

  // Update idempotency settings (for feature flag changes)
  updateSettings(enabled: boolean, ttlSeconds?: number): void {
    this.enabled = enabled;
    if (ttlSeconds !== undefined) {
      this.ttlSeconds = ttlSeconds;
    }
    
    // Note: In a real implementation, you might want to re-register middleware
    // For now, we'll just update the settings for future requests
  }

  // Get current idempotency settings
  getSettings(): { enabled: boolean; ttlSeconds: number } {
    return {
      enabled: this.enabled,
      ttlSeconds: this.ttlSeconds
    };
  }

  // Test idempotency store connectivity
  async testStore(): Promise<boolean> {
    try {
      // Try to set and get a test key
      const testKey = 'test-connectivity';
      const testData = { test: true, timestamp: Date.now() };
      
      await this.store.set(testKey, 'test', '/test', 'test-hash', {
        statusCode: 200,
        body: testData
      });
      
      const retrieved = await this.store.get(testKey, 'test', '/test');
      await this.store.delete(testKey, 'test', '/test');
      
      return retrieved !== null;
    } catch (error) {
      console.error('Idempotency store connectivity test failed:', error);
      return false;
    }
  }
}

// Factory function to create and configure the idempotency adapter
export function createGatewayIdempotencyAdapter(
  fastify: FastifyInstance,
  store: IdempotencyStore,
  enabled: boolean = false,
  ttlSeconds: number = 86400
): GatewayIdempotencyAdapter {
  const adapter = new GatewayIdempotencyAdapter(fastify, store, enabled, ttlSeconds);
  
  // Register idempotency for known endpoints
  adapter.registerRunCreateIdempotency();
  
  return adapter;
}
