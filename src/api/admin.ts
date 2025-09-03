import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { memoryDB } from '../models/memory-db'
import { secretsProvider } from '../secrets/provider'
import { encryptString } from '../crypto/envelope'
import { recordChaosInjection, recordChaosClearing } from '../observability/metrics'
import { z } from 'zod'

// Chaos injection state (dev-only)
const chaosState = new Map<string, { mode: string; pct: number }>()

// Validation schemas
const SetCredentialSchema = z.object({
  tool: z.string(),
  version: z.string(),
  credential: z.string(),
  metadata: z.record(z.any()).optional()
})

const ActivateCredentialSchema = z.object({
  id: z.string()
})

const ChaosSchema = z.object({
  tool: z.string(),
  mode: z.enum(['timeout', '500', 'jitter']),
  pct: z.number().min(0).max(100)
})

export async function adminRoutes(fastify: FastifyInstance) {
  // Chaos injection (dev-only)
  fastify.post('/admin/chaos/tool', {
    schema: {
      body: {
        type: 'object',
        required: ['tool', 'mode', 'pct'],
        properties: {
          tool: { type: 'string' },
          mode: { type: 'string', enum: ['timeout', '500', 'jitter'] },
          pct: { type: 'number', minimum: 0, maximum: 100 }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: z.infer<typeof ChaosSchema> }>, reply: FastifyReply) => {
    try {
      const { tool, mode, pct } = request.body

      // Only allow in development
      if (process.env.NODE_ENV === 'production') {
        return reply.status(403).send({ error: 'Chaos injection not allowed in production' })
      }

      chaosState.set(tool, { mode, pct })
      
      console.log(`Chaos injected for ${tool}: ${mode} at ${pct}%`)
      recordChaosInjection(tool, mode)

      return reply.status(200).send({
        message: 'Chaos injected successfully',
        tool,
        mode,
        pct,
        activeChaos: Array.from(chaosState.entries())
      })
    } catch (error: any) {
      console.error('Error injecting chaos:', error)
      return reply.status(500).send({ error: 'Failed to inject chaos', details: error.message })
    }
  })

  // Clear chaos injection
  fastify.delete('/admin/chaos/tool/:tool', async (request: FastifyRequest<{ Params: { tool: string } }>, reply: FastifyReply) => {
    try {
      const { tool } = request.params

      // Only allow in development
      if (process.env.NODE_ENV === 'production') {
        return reply.status(403).send({ error: 'Chaos injection not allowed in production' })
      }

      chaosState.delete(tool)
      
      console.log(`Chaos cleared for ${tool}`)
      recordChaosClearing(tool)

      return reply.status(200).send({
        message: 'Chaos cleared successfully',
        tool,
        activeChaos: Array.from(chaosState.entries())
      })
    } catch (error: any) {
      console.error('Error clearing chaos:', error)
      return reply.status(500).send({ error: 'Failed to clear chaos', details: error.message })
    }
  })

  // Get chaos state
  fastify.get('/admin/chaos', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.status(200).send({
        activeChaos: Array.from(chaosState.entries())
      })
    } catch (error: any) {
      console.error('Error getting chaos state:', error)
      return reply.status(500).send({ error: 'Failed to get chaos state', details: error.message })
    }
  })



  // Set a new tool credential
  fastify.post('/admin/creds/set', {
    schema: {
      body: {
        type: 'object',
        required: ['tool', 'version', 'credential'],
        properties: {
          tool: { type: 'string' },
          version: { type: 'string' },
          credential: { type: 'string' },
          metadata: { type: 'object' }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: z.infer<typeof SetCredentialSchema> }>, reply: FastifyReply) => {
    try {
      const { tool, version, credential, metadata } = request.body

      // Get the KEK from environment
      const kekBase64 = process.env.KEK_BASE64
      if (!kekBase64) {
        return reply.status(500).send({ error: 'KEK_BASE64 not configured' })
      }
      const kek = Buffer.from(kekBase64, 'base64')

      // Encrypt the credential
      const encryptedCredential = encryptString(credential, kek)
      const encryptedMetadata = metadata ? encryptString(JSON.stringify(metadata), kek) : undefined

      // Create the credential
      const toolCredential = await memoryDB.createToolCredential({
        tool,
        version,
        isActive: false,
        encryptedCredential,
        metadata: encryptedMetadata
      })

      return reply.status(201).send({
        message: 'Credential created successfully',
        id: toolCredential.id,
        tool: toolCredential.tool,
        version: toolCredential.version,
        isActive: toolCredential.isActive
      })
    } catch (error: any) {
      console.error('Error setting credential:', error)
      return reply.status(500).send({ error: 'Failed to set credential', details: error.message })
    }
  })

  // Activate a tool credential
  fastify.post('/admin/creds/activate', {
    schema: {
      body: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: z.infer<typeof ActivateCredentialSchema> }>, reply: FastifyReply) => {
    try {
      const { id } = request.body

      const credential = await memoryDB.activateToolCredential(id)
      if (!credential) {
        return reply.status(404).send({ error: 'Credential not found' })
      }

      return reply.status(200).send({
        message: 'Credential activated successfully',
        id: credential.id,
        tool: credential.tool,
        version: credential.version,
        isActive: credential.isActive,
        activatedAt: credential.activatedAt
      })
    } catch (error: any) {
      console.error('Error activating credential:', error)
      return reply.status(500).send({ error: 'Failed to activate credential', details: error.message })
    }
  })

  // Get active credential for a tool
  fastify.get('/admin/creds/:tool', async (request: FastifyRequest<{ Params: { tool: string } }>, reply: FastifyReply) => {
    try {
      const { tool } = request.params

      const credential = await memoryDB.findActiveToolCredential(tool)
      if (!credential) {
        return reply.status(404).send({ error: 'No active credential found for tool' })
      }

      return reply.status(200).send({
        id: credential.id,
        tool: credential.tool,
        version: credential.version,
        isActive: credential.isActive,
        createdAt: credential.createdAt,
        activatedAt: credential.activatedAt
      })
    } catch (error: any) {
      console.error('Error getting credential:', error)
      return reply.status(500).send({ error: 'Failed to get credential', details: error.message })
    }
  })

  // List all credentials for a tool
  fastify.get('/admin/creds/:tool/versions', async (request: FastifyRequest<{ Params: { tool: string } }>, reply: FastifyReply) => {
    try {
      const { tool } = request.params

      const credentials = await memoryDB.findToolCredentialsByTool(tool)
      
      const response = credentials.map(cred => ({
        id: cred.id,
        tool: cred.tool,
        version: cred.version,
        isActive: cred.isActive,
        createdAt: cred.createdAt,
        activatedAt: cred.activatedAt,
        deactivatedAt: cred.deactivatedAt
      }))

      return reply.status(200).send(response)
    } catch (error: any) {
      console.error('Error listing credentials:', error)
      return reply.status(500).send({ error: 'Failed to list credentials', details: error.message })
    }
  })

  // List all tool credentials
  fastify.get('/admin/creds', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const credentials = await memoryDB.getAllToolCredentials()
      
      const response = credentials.map(cred => ({
        id: cred.id,
        tool: cred.tool,
        version: cred.version,
        isActive: cred.isActive,
        createdAt: cred.createdAt,
        activatedAt: cred.activatedAt,
        deactivatedAt: cred.deactivatedAt
      }))

      return reply.status(200).send(response)
    } catch (error: any) {
      console.error('Error listing all credentials:', error)
      return reply.status(500).send({ error: 'Failed to list credentials', details: error.message })
    }
  })

  // Delete a credential
  fastify.delete('/admin/creds/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params

      const deleted = await memoryDB.deleteToolCredential(id)
      if (!deleted) {
        return reply.status(404).send({ error: 'Credential not found' })
      }

      return reply.status(200).send({ message: 'Credential deleted successfully' })
    } catch (error: any) {
      console.error('Error deleting credential:', error)
      return reply.status(500).send({ error: 'Failed to delete credential', details: error.message })
    }
  })

  // Revoke a token
  fastify.post('/admin/tokens/:tokenId/revoke', async (request: FastifyRequest<{ Params: { tokenId: string } }>, reply: FastifyReply) => {
    try {
      const { tokenId } = request.params

      const registry = await memoryDB.revokeToken(tokenId)
      if (!registry) {
        return reply.status(404).send({ error: 'Token not found' })
      }

      return reply.status(200).send({
        message: 'Token revoked successfully',
        tokenId: registry.tokenId,
        revokedAt: registry.revokedAt
      })
    } catch (error: any) {
      console.error('Error revoking token:', error)
      return reply.status(500).send({ error: 'Failed to revoke token', details: error.message })
    }
  })

  // List token registry
  fastify.get('/admin/tokens', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const registry = await memoryDB.getAllTokenRegistry()
      
      const response = registry.map(reg => ({
        id: reg.id,
        tokenId: reg.tokenId,
        agentId: reg.agentId,
        issuedAt: reg.issuedAt,
        expiresAt: reg.expiresAt,
        isRevoked: reg.isRevoked,
        revokedAt: reg.revokedAt
      }))

      return reply.status(200).send(response)
    } catch (error: any) {
      console.error('Error listing token registry:', error)
      return reply.status(500).send({ error: 'Failed to list token registry', details: error.message })
    }
  })
}

// Export chaos state for tools to use
export function getChaosState(tool: string) {
  return chaosState.get(tool)
}
