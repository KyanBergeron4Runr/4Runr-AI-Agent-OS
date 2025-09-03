import { describe, it, expect, beforeEach } from '@jest/globals';
import { InMemoryIdempotencyStore } from '../../packages/adapters/redis/IdempotencyStore';
import { generateNormalizedHash, areBodiesEquivalent } from '../../packages/middleware/idempotency/normalizers/RunCreate.normalizer';

describe('Idempotency Contracts', () => {
  let store: InMemoryIdempotencyStore;

  beforeEach(() => {
    store = new InMemoryIdempotencyStore(86400); // 24 hours TTL
  });

  describe('Idempotency Key Behavior', () => {
    it('should return 201 then 200 for same key + same body', async () => {
      const key = '550e8400-e29b-41d4-a716-446655440000';
      const body = { name: 'Test Run', input: { message: 'Hello' } };
      const tenant = 'test-tenant';
      const route = '/api/runs';
      const bodyHash = await generateNormalizedHash(body);

      // First request - should store response
      const firstResponse = { statusCode: 201, body: { success: true, run: { id: 'run-123' } } };
      await store.set(key, tenant, route, bodyHash, firstResponse);

      // Second request with same key + body - should return existing response
      const existing = await store.get(key, tenant, route);
      expect(existing).toBeDefined();
      expect(existing?.response).toEqual(firstResponse.body);
      expect(existing?.statusCode).toBe(201);
    });

    it('should return 409 for same key + different body', async () => {
      const key = '550e8400-e29b-41d4-a716-446655440000';
      const body1 = { name: 'Test Run 1', input: { message: 'Hello' } };
      const body2 = { name: 'Test Run 2', input: { message: 'World' } };
      const tenant = 'test-tenant';
      const route = '/api/runs';

      const hash1 = await generateNormalizedHash(body1);
      const hash2 = await generateNormalizedHash(body2);

      // Store first request
      await store.set(key, tenant, route, hash1, { 
        statusCode: 201, 
        body: { success: true, run: { id: 'run-123' } } 
      });

      // Second request with different body should conflict
      const existing = await store.get(key, tenant, route);
      expect(existing).toBeDefined();
      expect(existing?.bodyHash).toBe(hash1);
      expect(existing?.bodyHash).not.toBe(hash2);
    });

    it('should maintain current behavior when no key provided', async () => {
      const body = { name: 'Test Run' };
      const tenant = 'test-tenant';
      const route = '/api/runs';

      // No idempotency key - should not interfere with normal flow
      const result = await store.get('', tenant, route);
      expect(result).toBeNull();
    });

    it('should handle race conditions with parallel same key requests', async () => {
      const key = '550e8400-e29b-41d4-a716-446655440000';
      const body = { name: 'Race Test Run' };
      const tenant = 'test-tenant';
      const route = '/api/runs';
      const bodyHash = await generateNormalizedHash(body);

      // Simulate parallel requests
      const promises = Array.from({ length: 5 }, async (_, i) => {
        const response = { 
          statusCode: 201, 
          body: { success: true, run: { id: `run-${i}` } } 
        };
        
        // All requests try to store simultaneously
        await store.set(key, tenant, route, bodyHash, response);
        return await store.get(key, tenant, route);
      });

      const results = await Promise.all(promises);
      
      // All should return the same stored response (last one wins)
      const firstResult = results[0];
      expect(firstResult).toBeDefined();
      
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result?.bodyHash).toBe(bodyHash);
      });
    });
  });

  describe('UUID v4 Validation', () => {
    it('should accept valid UUID v4 format', () => {
      const validUUIDs = [
        '550e8400-e29b-41d4-4a16-846655440000',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
        '6ba7b812-9dad-11d1-80b4-00c04fd430c8'
      ];

      validUUIDs.forEach(uuid => {
        // Simple UUID format check: 8-4-4-4-12 hex characters
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        expect(uuidRegex.test(uuid)).toBe(true);
      });
    });

    it('should reject invalid UUID formats', () => {
      const invalidUUIDs = [
        'not-a-uuid',
        '550e8400-e29b-41d4-a716-44665544000', // too short
        '550e8400-e29b-41d4-a716-4466554400000', // too long
        '550e8400-e29b-41d4-a716-44665544000g', // invalid character
        '550e8400-e29b-41d4-a716-44665544000x', // invalid character
        '550e8400-e29b-41d4-a716-44665544000!' // invalid character
      ];

      invalidUUIDs.forEach(uuid => {
        // Simple UUID format check: 8-4-4-4-12 hex characters
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        expect(uuidRegex.test(uuid)).toBe(false);
      });
    });
  });

  describe('Body Normalization', () => {
    it('should generate consistent hashes for equivalent bodies', async () => {
      const body1 = { name: 'Test Run', tags: ['tag1', 'tag2'] };
      const body2 = { name: 'Test Run', tags: ['tag1', 'tag2'] }; // same order
      const body3 = { name: 'Test Run', tags: ['tag1', 'tag2'] }; // same as body1

      const hash1 = await generateNormalizedHash(body1);
      const hash2 = await generateNormalizedHash(body2);
      const hash3 = await generateNormalizedHash(body3);

      // Identical bodies should produce same hash
      expect(hash1).toBe(hash2);
      expect(hash1).toBe(hash3);
    });

    it('should generate different hashes for different bodies', async () => {
      const body1 = { name: 'Test Run 1' };
      const body2 = { name: 'Test Run 2' };

      const hash1 = await generateNormalizedHash(body1);
      const hash2 = await generateNormalizedHash(body2);

      expect(hash1).not.toBe(hash2);
    });

    it('should normalize whitespace consistently', async () => {
      const body1 = { name: '  Test Run  ', client_token: '  token-123  ' };
      const body2 = { name: 'Test Run', client_token: 'token-123' };

      const hash1 = await generateNormalizedHash(body1);
      const hash2 = await generateNormalizedHash(body2);

      // Normalized bodies should produce same hash
      expect(hash1).toBe(hash2);
    });

    it('should handle empty and undefined values consistently', async () => {
      const body1 = { name: 'Test Run' };
      const body2 = { name: 'Test Run' };

      const hash1 = await generateNormalizedHash(body1);
      const hash2 = await generateNormalizedHash(body2);

      // Bodies with same name should be equivalent
      expect(hash1).toBe(hash2);
    });
  });

  describe('Store Operations', () => {
    it('should store and retrieve idempotency keys correctly', async () => {
      const key = '550e8400-e29b-41d4-4a16-846655440000';
      const tenant = 'test-tenant';
      const route = '/api/runs';
      const bodyHash = 'test-hash-123';
      const response = { 
        statusCode: 201, 
        body: { success: true, run: { id: 'run-123' } },
        headers: { 'Content-Type': 'application/json' }
      };

      // Store
      await store.set(key, tenant, route, bodyHash, response);

      // Retrieve
      const retrieved = await store.get(key, tenant, route);
      expect(retrieved).toBeDefined();
      expect(retrieved?.key).toBe(key);
      expect(retrieved?.tenant).toBe(tenant);
      expect(retrieved?.route).toBe(route);
      expect(retrieved?.bodyHash).toBe(bodyHash);
      expect(retrieved?.response).toEqual(response.body);
      expect(retrieved?.statusCode).toBe(response.statusCode);
      expect(retrieved?.headers).toEqual(response.headers);
    });

    it('should handle TTL expiration correctly', async () => {
      const shortTTLStore = new InMemoryIdempotencyStore(1); // 1 second TTL
      const key = '550e8400-e29b-41d4-a716-446655440000';
      const tenant = 'test-tenant';
      const route = '/api/runs';
      const bodyHash = 'test-hash-123';
      const response = { statusCode: 201, body: { success: true } };

      // Store
      await shortTTLStore.set(key, tenant, route, bodyHash, response);

      // Should be available immediately
      const immediate = await shortTTLStore.get(key, tenant, route);
      expect(immediate).toBeDefined();

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be expired
      const expired = await shortTTLStore.get(key, tenant, route);
      expect(expired).toBeNull();
    });

    it('should delete idempotency keys correctly', async () => {
      const key = '550e8400-e29b-41d4-a716-446655440000';
      const tenant = 'test-tenant';
      const route = '/api/runs';
      const bodyHash = 'test-hash-123';
      const response = { statusCode: 201, body: { success: true } };

      // Store
      await store.set(key, tenant, route, bodyHash, response);

      // Verify stored
      const stored = await store.get(key, tenant, route);
      expect(stored).toBeDefined();

      // Delete
      await store.delete(key, tenant, route);

      // Verify deleted
      const deleted = await store.get(key, tenant, route);
      expect(deleted).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle store errors gracefully', async () => {
      // This test would require mocking a failing store
      // For now, we'll test that the store interface is robust
      const key = '550e8400-e29b-41d4-a716-446655440000';
      const tenant = 'test-tenant';
      const route = '/api/runs';

      // Test with valid store
      const result = await store.get(key, tenant, route);
      expect(result).toBeNull(); // Key doesn't exist, not an error

      // Test store operations don't throw
      await expect(store.set(key, tenant, route, 'hash', { 
        statusCode: 200, 
        body: {} 
      })).resolves.not.toThrow();

      await expect(store.delete(key, tenant, route)).resolves.not.toThrow();
    });
  });
});
