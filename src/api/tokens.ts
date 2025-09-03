import { FastifyInstance } from 'fastify'
import { memoryDB } from '../models/memory-db'
import crypto from 'crypto'
import { recordTokenGeneration } from '../observability/metrics'

// Type definitions for request body
interface GenerateTokenBody {
  agent_id: string
  tools: string[]
  permissions: string[]
  expires_at: string
}

export async function tokenRoutes(server: FastifyInstance) {
  // POST /generate-token - Generate encrypted, signed token for agent
  server.post('/generate-token', async (request, reply) => {
    try {
      const { agent_id, tools, permissions, expires_at } = request.body as GenerateTokenBody

      // Validate required fields
      if (!agent_id || !tools || !permissions || !expires_at) {
        return reply.code(400).send({ 
          error: 'Missing required fields: agent_id, tools, permissions, and expires_at are required.' 
        })
      }

      // Validate tools and permissions are arrays
      if (!Array.isArray(tools) || !Array.isArray(permissions)) {
        return reply.code(400).send({ 
          error: 'Tools and permissions must be arrays.' 
        })
      }

      // Validate expiry date
      const expiryDate = new Date(expires_at)
      if (isNaN(expiryDate.getTime())) {
        return reply.code(400).send({ 
          error: 'Invalid expires_at date format. Use ISO 8601 format.' 
        })
      }

      // Check if token would be expired
      if (expiryDate <= new Date()) {
        return reply.code(400).send({ 
          error: 'Token expiry date must be in the future.' 
        })
      }

      // Find agent and get their public key
      const agent = await memoryDB.findAgentById(agent_id)

      if (!agent) {
        return reply.code(404).send({ error: 'Agent not found.' })
      }

      if (agent.status !== 'active') {
        return reply.code(400).send({ error: 'Agent is not active.' })
      }

      // Create token payload with security features
      const payload = JSON.stringify({
        agent_id,
        agent_name: agent.name,
        tools,
        permissions,
        expires_at,
        nonce: crypto.randomUUID(), // Prevent replay attacks
        issued_at: new Date().toISOString()
      })

      // Generate token ID and compute payload hash for provenance
      const tokenId = crypto.randomUUID()
      const payloadHash = crypto.createHash('sha256').update(payload).digest('hex')

      // Simplified token generation - use base64 encoding for now
      const base64Token = Buffer.from(payload).toString('base64')

      // Create HMAC signature for tamper protection
      const signingSecret = process.env.SIGNING_SECRET || 'default-secret-change-in-production'
      const signature = crypto
        .createHmac('sha256', signingSecret)
        .update(base64Token)
        .digest('hex')

      // Combine token with signature
      const finalToken = `${base64Token}.${signature}`

      // Store token in memory database for tracking
      await memoryDB.createToken({
        agentId: agent_id,
        encrypted: finalToken,
        expiresAt: expiryDate,
        revoked: false
      })

      // Record token generation metric
      recordTokenGeneration(agent_id)

      // Store token provenance in registry
      await memoryDB.createTokenRegistry({
        tokenId,
        agentId: agent_id,
        payloadHash,
        issuedAt: new Date(),
        expiresAt: expiryDate,
        isRevoked: false
      })

      return reply.code(201).send({ 
        agent_token: finalToken,
        token_id: tokenId,
        expires_at: expires_at,
        agent_name: agent.name
      })

    } catch (error) {
      console.error('Error generating token:', error)
      return reply.code(500).send({ 
        error: 'Internal server error while generating token.' 
      })
    }
  })

  // GET /tokens/:agent_id - List tokens for an agent (admin only)
  server.get('/tokens/:agent_id', async (request, reply) => {
    try {
      const { agent_id } = request.params as { agent_id: string }

      const tokens = await memoryDB.findTokensByAgentId(agent_id)

      return reply.send({ tokens })

    } catch (error) {
      console.error('Error fetching tokens:', error)
      return reply.code(500).send({ 
        error: 'Internal server error while fetching tokens.' 
      })
    }
  })

  // POST /tokens/:token_id/revoke - Revoke a token
  server.post('/tokens/:token_id/revoke', async (request, reply) => {
    try {
      const { token_id } = request.params as { token_id: string }

      const token = await memoryDB.updateToken(token_id, { revoked: true })

      if (!token) {
        return reply.code(404).send({ error: 'Token not found.' })
      }

      return reply.send({ 
        message: 'Token revoked successfully.',
        token_id: token.id 
      })

    } catch (error) {
      console.error('Error revoking token:', error)
      return reply.code(500).send({ 
        error: 'Internal server error while revoking token.' 
      })
    }
  })
}
