import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema } from 'zod';

export type ValidationMode = 'strict' | 'warn' | 'off';

export interface ValidationOptions {
  mode: ValidationMode;
  schema: ZodSchema;
  endpoint: string;
  tenant?: string;
}

// Generic validation middleware for Fastify
export function createValidationMiddleware(options: ValidationOptions) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { mode, schema, endpoint, tenant } = options;
    
    if (mode === 'off') {
      // Skip validation entirely
      return;
    }
    
    try {
      // Validate request body
      const result = schema.safeParse(request.body);
      
      if (!result.success) {
        const errors = result.error.issues.map(issue => ({
          path: issue.path.join('.'),
          code: issue.code,
          message: issue.message
        }));
        
        // Log validation rejection
        request.log.info({
          msg: 'validation.reject',
          endpoint,
          tenant: tenant || 'default',
          paths: errors.map(e => e.path),
          mode
        });
        
        if (mode === 'strict') {
          // Reject with 422 + machine-readable error body
          return reply.status(422).send({
            error: 'validation_error',
            details: errors
          });
        } else if (mode === 'warn') {
          // Log warning but continue
          request.log.warn({
            msg: 'validation.warning',
            endpoint,
            tenant: tenant || 'default',
            errors
          });
        }
      } else {
        // Validation passed, replace request.body with validated data
        request.body = result.data;
        
        // Log successful validation
        request.log.debug({
          msg: 'validation.success',
          endpoint,
          tenant: tenant || 'default'
        });
      }
    } catch (error) {
      // Handle unexpected validation errors
      request.log.error({
        msg: 'validation.error',
        endpoint,
        tenant: tenant || 'default',
        error: error instanceof Error ? error.message : String(error)
      });
      
      if (mode === 'strict') {
        return reply.status(500).send({
          error: 'validation_system_error',
          message: 'Internal validation error'
        });
      }
    }
  };
}

// Helper function to create validation middleware for specific endpoints
export function createEndpointValidation(schema: ZodSchema, endpoint: string) {
  return (mode: ValidationMode = 'strict') => 
    createValidationMiddleware({ mode, schema, endpoint });
}

// Export common validation modes
export const VALIDATION_MODES = {
  STRICT: 'strict' as const,
  WARN: 'warn' as const,
  OFF: 'off' as const
} as const;
