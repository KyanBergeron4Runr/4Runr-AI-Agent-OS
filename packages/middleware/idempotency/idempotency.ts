import { FastifyRequest, FastifyReply } from 'fastify';
import { IdempotencyStore } from '../../adapters/redis/IdempotencyStore';

export interface IdempotencyOptions {
  enabled: boolean;
  ttlSeconds: number;
  store: IdempotencyStore;
}

export interface IdempotencyKey {
  key: string;
  tenant?: string;
  route: string;
  bodyHash: string;
  response: any;
  statusCode: number;
  headers?: Record<string, string>;
  createdAt: Date;
  expiresAt: Date;
}

export interface IdempotencyResult {
  isIdempotent: boolean;
  existingResponse?: {
    statusCode: number;
    body: any;
    headers?: Record<string, string>;
  };
  conflict?: {
    existingHash: string;
    newHash: string;
    message: string;
  };
}

// Create idempotency middleware
export function createIdempotencyMiddleware(options: IdempotencyOptions) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { enabled, store } = options;
    
    if (!enabled) {
      return; // Skip idempotency checks
    }
    
    const idempotencyKey = request.headers['idempotency-key'] as string;
    if (!idempotencyKey) {
      return; // No key provided, continue normally
    }
    
    // Validate UUID v4 format
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidV4Regex.test(idempotencyKey)) {
      return reply.status(400).send({
        error: 'invalid_idempotency_key',
        message: 'Idempotency-Key must be a valid UUID v4'
      });
    }
    
    const route = request.routerPath || request.url;
    const tenant = (request.headers['x-tenant'] as string) || 'default';
    const bodyHash = await generateBodyHash(request.body);
    
    try {
      // Check for existing idempotent request
      const existing = await store.get(idempotencyKey, tenant, route);
      
      if (existing) {
        // Check if body hash matches
        if (existing.bodyHash === bodyHash) {
          // Same key + same body = return existing response
          request.log.info({
            msg: 'idempotency.hit',
            key: idempotencyKey,
            tenant,
            route,
            hash: bodyHash
          });
          
          // Return existing response with 200 (not 201)
          return reply
            .status(existing.statusCode === 201 ? 200 : existing.statusCode)
            .headers(existing.headers || {})
            .send(existing.response);
        } else {
          // Same key + different body = conflict
          request.log.warn({
            msg: 'idempotency.conflict',
            key: idempotencyKey,
            tenant,
            route,
            existingHash: existing.bodyHash,
            newHash: bodyHash
          });
          
          return reply.status(409).send({
            error: 'idempotency_conflict',
            message: 'Idempotency key already used with different request body',
            metadata: {
              existingHash: existing.bodyHash,
              newHash: bodyHash,
              existingResponse: existing.response,
              createdAt: existing.createdAt
            }
          });
        }
      }
      
      // No existing request, store this one for future idempotency
      // We'll need to capture the response, so we'll do this in a hook
      request.idempotencyContext = {
        key: idempotencyKey,
        tenant,
        route,
        bodyHash,
        store
      };
      
    } catch (error) {
      request.log.error({
        msg: 'idempotency.error',
        key: idempotencyKey,
        tenant,
        route,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // On error, continue without idempotency (fail open)
      return;
    }
  };
}

// Hook to capture response for idempotency storage
export async function captureIdempotencyResponse(
  request: FastifyRequest,
  reply: FastifyReply,
  payload: any
) {
  const context = (request as any).idempotencyContext;
  if (!context) {
    return payload; // No idempotency context
  }
  
  try {
    const { key, tenant, route, bodyHash, store } = context;
    
    // Store the response for future idempotency
    await store.set(key, tenant, route, bodyHash, {
      statusCode: reply.statusCode,
      body: payload,
      headers: reply.getHeaders()
    });
    
    request.log.info({
      msg: 'idempotency.store',
      key,
      tenant,
      route,
      hash: bodyHash
    });
    
  } catch (error) {
    request.log.error({
      msg: 'idempotency.store_error',
      error: error instanceof Error ? error.message : String(error)
    });
    // Don't fail the request on storage error
  }
  
  return payload;
}

// Helper function to generate body hash
async function generateBodyHash(body: any): Promise<string> {
  const text = JSON.stringify(body || {});
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  
  // Use Web Crypto API if available, fallback to simple hash
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } else {
    // Simple fallback hash for environments without Web Crypto
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

// Extend FastifyRequest type to include idempotency context
declare module 'fastify' {
  interface FastifyRequest {
    idempotencyContext?: {
      key: string;
      tenant: string;
      route: string;
      bodyHash: string;
      store: IdempotencyStore;
    };
  }
}
