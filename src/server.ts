import * as dotenv from 'dotenv'
dotenv.config()

import { validateEnv } from './config/validate'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { agentRoutes } from './api/agents'
import { tokenRoutes } from './api/tokens'
import { proxyRoutes } from './api/proxy'
import { policyRoutes } from './api/policies'
import { adminRoutes } from './api/admin'
import { sandboxRoutes } from './api/sandbox'
import { sentinelRoutes } from './api/sentinel'
import { coachRoutes } from './api/coach'
// import { healthRoutes } from './api/health' // MVP: Temporarily disabled
import { lifecycleManager } from './runtime/lifecycle'
// Agent runtime routes
import createAgentRoute from './api/agents/create'
import startAgentRoute from './api/agents/start'
// Schedule routes
import createScheduleRoute from './api/schedules/create'
import updateScheduleRoute from './api/schedules/update'
import deleteScheduleRoute from './api/schedules/delete'
import listScheduleRoute from './api/schedules/list'
import toggleScheduleRoute from './api/schedules/toggle'
// Monitoring routes
import streamLogsRoute from './api/runs/streamLogs'
import agentStatusRoute from './api/agents/status'
import agentMetricsRoute from './api/agents/metrics'
import agentSummaryRoute from './api/agents/summary'
import kpisRoute from './api/summary/kpis'
import demoRoutes from './api/demo'
// Services
import { startSchedulerService } from './scheduler/service'
import { startStatsSampler } from './runtime/stats'
// Temporarily disabled for MVP
// import { memoryMonitor } from './runtime/memory-monitor'
// import { gatewayCircuitBreaker } from './runtime/circuit-breaker'
// import { rateLimitManager, RATE_LIMITS } from './runtime/rate-limiter'

// Add graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.warn('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the warning
});

// Add memory monitoring
setInterval(() => {
  const memUsage = process.memoryUsage();
  const memUsageMB = {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024)
  };
  
  if (memUsageMB.heapUsed > 800) {
    console.log(`⚠️  High memory usage: ${memUsageMB.heapUsed}MB heap used`);
  }
}, 30000); // Check every 30 seconds

// Validate environment variables before starting
try {
  validateEnv()
  console.log('✅ Environment validation passed')
} catch (error) {
  console.error('❌ Environment validation failed:', error instanceof Error ? error.message : error)
  process.exit(1)
}

// Create Fastify instance with connection limits
const server = Fastify({
  logger: true,
  connectionTimeout: 10000, // 10 second timeout
  keepAliveTimeout: 5000,   // 5 second keep-alive
  maxParamLength: 1000,     // Limit parameter length
  bodyLimit: 1048576 * 10,  // 10MB body limit
  // Remove server factory for now - causes type issues
})

// Register CORS plugin
server.register(cors, {
  origin: true // Allow all origins for development
})

// MVP: Rate limiting temporarily disabled for core agent runtime implementation
// Will re-enable after agent runtime is working

// MVP: Circuit breaker temporarily disabled for core agent runtime implementation
// Will re-enable after agent runtime is working

// Register API routes
server.register(agentRoutes, { prefix: '/api' })
server.register(tokenRoutes, { prefix: '/api' })
server.register(proxyRoutes, { prefix: '/api' })
server.register(policyRoutes, { prefix: '/api' })
server.register(adminRoutes, { prefix: '/api' })
server.register(sandboxRoutes, { prefix: '/api' })
server.register(sentinelRoutes, { prefix: '/api' })

// Register Coach routes
server.register(coachRoutes, { prefix: '/api' })

// Register individual routes
server.register(createAgentRoute, { prefix: '/api' })
server.register(startAgentRoute, { prefix: '/api' })
server.register(createScheduleRoute, { prefix: '/api' })
server.register(updateScheduleRoute, { prefix: '/api' })
server.register(deleteScheduleRoute, { prefix: '/api' })
server.register(listScheduleRoute, { prefix: '/api' })
server.register(toggleScheduleRoute, { prefix: '/api' })
server.register(streamLogsRoute, { prefix: '/api' })
server.register(agentStatusRoute, { prefix: '/api' })
server.register(agentMetricsRoute, { prefix: '/api' })
server.register(agentSummaryRoute, { prefix: '/api' })
server.register(kpisRoute, { prefix: '/api' })
server.register(demoRoutes, { prefix: '/api' })

// Add health check endpoint
server.get('/api/health', async (request, reply) => {
  return { 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  }
})

// Start the server
const start = async () => {
  try {
    // Start services that don't depend on Redis
    console.log('🚀 4Runr Gateway starting in LIVE mode')
    
    // Start stats sampler (doesn't need Redis)
    try {
      await startStatsSampler()
      console.log('📊 Monitoring active - resource tracking and auto-restart enabled!')
    } catch (error) {
      console.warn('⚠️ Stats sampler failed to start:', error instanceof Error ? error.message : String(error))
    }
    
    // Try to start scheduler service (will fail gracefully if Redis unavailable)
    try {
      await startSchedulerService()
    } catch (error) {
      console.warn('⚠️ Scheduler service failed to start (Redis unavailable):', error instanceof Error ? error.message : String(error))
    }
    
    // Lifecycle manager is already initialized
    console.log('🤖 AI Agent Runtime MVP active - ready for agent deployment!')
    
    // Start the server
    await server.listen({ port: 3000, host: '127.0.0.1' })
    console.log('🚀 4Runr Gateway server running on http://localhost:3000')
    
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
