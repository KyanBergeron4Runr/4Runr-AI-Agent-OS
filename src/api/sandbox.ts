import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { memoryDB } from '../models/memory-db'
import { generateCorrelationId } from '../runtime/http'
import { executeWithCircuitBreaker } from '../runtime/circuit'
import { executeWithRetry } from '../runtime/retry'
import { 
  recordRequest, 
  recordRequestDuration, 
  recordRetry, 
  recordPolicyDenial, 
  recordTokenValidation, 
  recordTokenExpiration,
  recordCacheHit,
  recordBreakerFastFail,
  setBreakerState,
  startRequestTimer
} from '../observability/metrics'
import { routes as toolRoutes } from '../tools'
import crypto from 'crypto'

// Simple token generation function
function generateToken(data: { agentId: string; scopes: string[]; ttlSeconds: number }): string {
  const tokenData = {
    agentId: data.agentId,
    scopes: data.scopes,
    expiresAt: new Date(Date.now() + data.ttlSeconds * 1000).toISOString(),
    tokenId: crypto.randomUUID()
  }
  return Buffer.from(JSON.stringify(tokenData)).toString('base64')
}

// Simple token validation function
function validateToken(token: string): { valid: boolean; data?: any; error?: string } {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8')
    const data = JSON.parse(decoded)
    
    if (new Date(data.expiresAt) < new Date()) {
      return { valid: false, error: 'Token expired' }
    }
    
    return { valid: true, data }
  } catch (error) {
    return { valid: false, error: 'Invalid token format' }
  }
}

// Validation schemas
const TokenRequestSchema = z.object({
  agentId: z.string().uuid(),
  scopes: z.array(z.string()).min(1),
  ttlSeconds: z.number().min(30).max(3600).optional().default(120)
})

const IntrospectRequestSchema = z.object({
  token: z.string().min(1)
})

const RequestComposerSchema = z.object({
  agentId: z.string().uuid(),
  tool: z.string().min(1),
  action: z.string().min(1),
  params: z.record(z.any())
})

// Helper function to scrub sensitive data
function scrubSensitiveData(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj
  
  const scrubbed = { ...obj }
  const sensitiveKeys = ['authorization', 'authorization', 'kek', 'dek', 'api_key', 'secret', 'password', 'token']
  
  for (const key of Object.keys(scrubbed)) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      scrubbed[key] = '***'
    } else if (typeof scrubbed[key] === 'object') {
      scrubbed[key] = scrubSensitiveData(scrubbed[key])
    }
  }
  
  return scrubbed
}

export async function sandboxRoutes(server: FastifyInstance) {
  // Guard: Only enable in demo mode
  server.addHook('preHandler', async (request, reply) => {
    if (process.env.DEMO_MODE !== 'on') {
      return reply.code(403).send({ error: 'Sandbox endpoints only available in demo mode' })
    }
  })

  // Rate limiting for sandbox endpoints
  const rateLimiter = new Map<string, { count: number; resetTime: number }>()
  
  server.addHook('preHandler', async (request, reply) => {
    const ip = request.ip || 'unknown'
    const now = Date.now()
    const windowMs = 60 * 1000 // 1 minute
    
    if (!rateLimiter.has(ip) || now > rateLimiter.get(ip)!.resetTime) {
      rateLimiter.set(ip, { count: 1, resetTime: now + windowMs })
    } else {
      const record = rateLimiter.get(ip)!
      record.count++
      
      if (record.count > 10) { // 10 requests per minute
        return reply.code(429).send({ error: 'Rate limit exceeded' })
      }
    }
  })

  // POST /sandbox/token - Generate a short-lived token
  server.post('/sandbox/token', {
    schema: {
      body: {
        type: 'object',
        required: ['agentId', 'scopes'],
        properties: {
          agentId: { type: 'string', format: 'uuid' },
          scopes: { type: 'array', items: { type: 'string' }, minItems: 1 },
          ttlSeconds: { type: 'number', minimum: 30, maximum: 3600, default: 120 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { agentId, scopes, ttlSeconds } = request.body as z.infer<typeof TokenRequestSchema>
      
      // Verify agent exists
      const agent = await memoryDB.findAgentById(agentId)
      if (!agent) {
        return reply.code(404).send({ error: 'Agent not found' })
      }
      
      // Generate token
      const token = generateToken({
        agentId: agentId,
        scopes: scopes,
        ttlSeconds: ttlSeconds
      })
      
      // Store in registry for introspection
      const tokenId = crypto.randomUUID()
      await memoryDB.createTokenRegistry({
        tokenId: tokenId,
        agentId: agentId,
        payloadHash: Buffer.from(token).toString('base64'),
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
        isRevoked: false
      })
      
      // Parse token for display
      const tokenData = JSON.parse(Buffer.from(token, 'base64').toString())
      
      return {
        token: token,
        data: scrubSensitiveData(tokenData),
        expiresAt: tokenData.expiresAt,
        proof: {
          tokenId: tokenId,
          agentId: agentId,
          scopes: scopes,
          ttlSeconds: ttlSeconds
        }
      }
    } catch (error) {
      console.error('Error generating sandbox token:', error)
      return reply.code(500).send({ error: 'Failed to generate token' })
    }
  })

  // POST /sandbox/token/introspect - Introspect a token
  server.post('/sandbox/token/introspect', {
    schema: {
      body: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', minLength: 1 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { token } = request.body as z.infer<typeof IntrospectRequestSchema>
      
      // Validate token
      const validation = validateToken(token)
      
      if (!validation.valid) {
        return {
          valid: false,
          error: validation.error,
          expiresAt: null,
          scopes: [],
          agentId: null,
          provenance: null,
          payload: null,
          header: null,
          hash: null
        }
      }
      
      // Parse token for display
      const tokenData = JSON.parse(Buffer.from(token, 'base64').toString())
      
      // Find in registry
      const registry = await memoryDB.findTokenRegistryByTokenId(tokenData.tokenId)
      
              return {
          valid: true,
          expiresAt: tokenData.expiresAt,
          scopes: tokenData.scopes || [],
          agentId: tokenData.agentId,
                    provenance: registry ? {
            tokenId: registry.tokenId,
            issuedAt: registry.issuedAt,
            isRevoked: registry.isRevoked
          } : null,
          payload: scrubSensitiveData(tokenData),
          header: null,
        hash: Buffer.from(token).toString('base64').substring(0, 16) + '...'
      }
    } catch (error) {
      console.error('Error introspecting token:', error)
      return reply.code(500).send({ error: 'Failed to introspect token' })
    }
  })

  // POST /sandbox/request - Compose and execute a request
  server.post('/sandbox/request', {
    schema: {
      body: {
        type: 'object',
        required: ['agentId', 'tool', 'action', 'params'],
        properties: {
          agentId: { type: 'string', format: 'uuid' },
          tool: { type: 'string', minLength: 1 },
          action: { type: 'string', minLength: 1 },
          params: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    const correlationId = generateCorrelationId()
    reply.header('X-Correlation-Id', correlationId)
    
    try {
      const { agentId, tool, action, params } = request.body as z.infer<typeof RequestComposerSchema>
      
      // Verify agent exists
      const agent = await memoryDB.findAgentById(agentId)
      if (!agent) {
        return reply.code(404).send({ error: 'Agent not found' })
      }
      
      // Generate short-lived token for this request
      const token = generateToken({
        agentId: agentId,
        scopes: [tool],
        ttlSeconds: 60 // 60 seconds
      })
      
      // Start metrics timer
      const timer = startRequestTimer(tool, action)
      
      // Prepare request data
      const requestData = {
        agent_token: token,
        tool,
        action,
        params
      }
      
      // Capture request details for response
      const requestDetails = {
        method: 'POST',
        path: `/api/proxy-request`,
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-Id': correlationId
        },
        body: scrubSensitiveData(requestData)
      }
      
      let decision = { allowed: false, reason: 'Unknown', kind: 'unknown' }
      let response = { status: 500, body: { error: 'Request failed' } }
      let metrics = { latency: 0, retries: 0, breaker: 'closed' }
      const startTime = Date.now()
      
      try {
        // Check if tool/action exists
        if (!toolRoutes[tool] || !toolRoutes[tool][action]) {
          decision = { allowed: false, reason: `Tool ${tool}:${action} not available`, kind: 'tool_not_found' }
          response = { status: 404, body: { error: `Tool ${tool}:${action} not available` } }
        } else {
          // Execute the request through the proxy logic
          
          // Simulate proxy execution
          const result = await toolRoutes[tool][action](params)
          
          const latency = Date.now() - startTime
          // Timer is handled by the metrics system
          
          decision = { allowed: true, reason: 'Request allowed', kind: 'allowed' }
          response = { status: 200, body: result }
          metrics = { latency, retries: 0, breaker: 'closed' }
        }
      } catch (error) {
        const latency = Date.now() - startTime
        // Timer is handled by the metrics system
        
        decision = { allowed: false, reason: (error as Error).message, kind: 'error' }
        response = { status: 500, body: { error: (error as Error).message } }
        metrics = { latency, retries: 0, breaker: 'closed' }
      }
      
      // Generate cURL command
      const curlCommand = `curl -X POST ${server.server.address()}/api/proxy-request \\
  -H "Content-Type: application/json" \\
  -H "X-Correlation-Id: ${correlationId}" \\
  -d '${JSON.stringify(requestData)}'`
      
      return {
        request: requestDetails,
        decision,
        response,
        metrics,
        curl: curlCommand,
        correlationId
      }
    } catch (error) {
      console.error('Error in sandbox request:', error)
      return reply.code(500).send({ error: 'Failed to process request' })
    }
  })

  // GET /api/metrics/summary - Get metrics summary
  server.get('/api/metrics/summary', async (request, reply) => {
    try {
      const { window = '15m' } = request.query as { window?: string }
      
      // For now, return stub data
      // TODO: Implement real metrics aggregation
      return {
        p50: 150,
        p95: 450,
        requestsByCode: {
          '200': 85,
          '400': 10,
          '403': 5
        },
        denialsByKind: {
          'unauthorized': 3,
          'tool_not_found': 2
        },
        retries: 12,
        breaker: {
          serpapi: 'closed',
          openai: 'closed',
          http_fetch: 'closed'
        }
      }
    } catch (error) {
      console.error('Error getting metrics summary:', error)
      return reply.code(500).send({ error: 'Failed to get metrics summary' })
    }
  })
}
