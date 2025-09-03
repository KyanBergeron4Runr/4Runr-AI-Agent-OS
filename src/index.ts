import * as dotenv from 'dotenv'
dotenv.config()

import Fastify from 'fastify'
import cors from '@fastify/cors'
import { agentRoutes } from './api/agents'
import { tokenRoutes } from './api/tokens'
import { proxyRoutes } from './api/proxy'
import { policyRoutes } from './api/policies'
import { adminRoutes } from './api/admin'
import { healthRoutes } from './api/health'
import { sentinelRoutes } from './api/sentinel'
import { lifecycleManager } from './runtime/lifecycle'

// Create Fastify instance
export const buildServer = async () => {
  const server = Fastify({
    logger: true
  })

  // Register CORS plugin
  await server.register(cors, {
    origin: true // Allow all origins for development
  })

  // Register API routes
  await server.register(agentRoutes, { prefix: '/api' })
  await server.register(tokenRoutes, { prefix: '/api' })
  await server.register(proxyRoutes, { prefix: '/api' })
  await server.register(policyRoutes, { prefix: '/api' })
  await server.register(adminRoutes, { prefix: '/api' })
  await server.register(sentinelRoutes, { prefix: '/api' })
  await server.register(healthRoutes) // Health routes at root level

  return server
}

// For direct execution (not testing)
if (require.main === module) {
  const start = async () => {
    try {
      const server = await buildServer()
      await server.listen({ port: 3000, host: '0.0.0.0' })
      console.log('🚀 4Runr Gateway server running on http://localhost:3000')
      
      // Register server shutdown handler
      lifecycleManager.onShutdown(async () => {
        console.log('Shutting down Fastify server...')
        await server.close()
      })
      
    } catch (err) {
      console.error(err)
      process.exit(1)
    }
  }

  start()
}
