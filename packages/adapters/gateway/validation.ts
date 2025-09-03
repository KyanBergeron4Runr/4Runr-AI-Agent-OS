import { FastifyInstance } from 'fastify';
import { createEndpointValidation } from '../../middleware/validation/validateRequest';
import { RunCreateInputSchema } from '../../middleware/validation/schemas/RunCreate.schema';

// Gateway validation adapter - wires validation middleware to existing routes
export class GatewayValidationAdapter {
  private fastify: FastifyInstance;
  private validationMode: 'strict' | 'warn' | 'off';

  constructor(fastify: FastifyInstance, validationMode: 'strict' | 'warn' | 'off' = 'strict') {
    this.fastify = fastify;
    this.validationMode = validationMode;
  }

  // Register validation middleware for run creation
  registerRunCreateValidation(): void {
    const validationMiddleware = createEndpointValidation(
      RunCreateInputSchema, 
      '/api/runs'
    )(this.validationMode);

    // Add validation as preHandler hook to existing route
    this.fastify.addHook('preHandler', async (request, reply) => {
      // Only apply to POST /api/runs
      if (request.method === 'POST' && request.routerPath === '/api/runs') {
        await validationMiddleware(request, reply);
      }
    });
  }

  // Register validation for other endpoints (future expansion)
  registerEndpointValidation(endpoint: string, schema: any): void {
    const validationMiddleware = createEndpointValidation(schema, endpoint)(this.validationMode);

    this.fastify.addHook('preHandler', async (request, reply) => {
      if (request.routerPath === endpoint) {
        await validationMiddleware(request, reply);
      }
    });
  }

  // Update validation mode (for feature flag changes)
  updateValidationMode(mode: 'strict' | 'warn' | 'off'): void {
    this.validationMode = mode;
    // Note: This would require re-registering middleware in a real implementation
    // For now, we'll just update the mode for future requests
  }

  // Get current validation mode
  getValidationMode(): 'strict' | 'warn' | 'off' {
    return this.validationMode;
  }
}

// Factory function to create and configure the validation adapter
export function createGatewayValidationAdapter(
  fastify: FastifyInstance,
  validationMode: 'strict' | 'warn' | 'off' = 'strict'
): GatewayValidationAdapter {
  const adapter = new GatewayValidationAdapter(fastify, validationMode);
  
  // Register validation for known endpoints
  adapter.registerRunCreateValidation();
  
  return adapter;
}
