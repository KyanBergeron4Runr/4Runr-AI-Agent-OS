import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { memoryDB } from '../models/memory-db'
import { executeWithCircuitBreaker } from '../runtime/circuit'
import { executeWithRetry } from '../runtime/retry'
import { getHealthStatus, getReadinessStatus } from '../runtime/lifecycle'
import { getEnhancedHealthStatus } from '../runtime/health-integration'
import { getMetricsResponse } from '../observability/metrics'
import { 
  getMonitoringDashboard, 
  getSystemHealthSummary, 
  getMetricsHistory,
  getMonitoringStats 
} from '../observability/monitoring-integration'
import {
  getAlertDashboard,
  getAlertStatistics,
  getAlertHistory,
  resolveAlert,
  acknowledgeAlert,
  createManualAlert,
  testAlertSystem
} from '../observability/alert-integration'
import {
  getDegradationStatus,
  getDegradationMetrics,
  isFeatureAvailable,
  forceDegradation,
  forceRecovery,
  triggerEmergencyActions,
  testDegradationSystem
} from '../runtime/degradation-integration'
// MVP: Temporarily disabled for core agent runtime implementation
// import {
//   getRecoveryStatus,
//   triggerRecovery,
//   triggerEscalatedRecovery,
//   getRecoveryStrategies,
//   addCustomRecoveryStrategy
// } from '../runtime/recovery-integration'
// import {
//   getDockerContainerStatus,
//   getContainerLogs,
//   triggerContainerRecovery,
//   getContainerPerformance
// } from '../services/docker-integration'

// Stub implementations for missing functions
function getRecoveryStatus() {
  return {
    totalAttempts: 0,
    successfulAttempts: 0,
    failedAttempts: 0,
    lastAttempt: null,
    strategies: []
  }
}

function getRecoveryStrategies() {
  return [
    { id: 'restart', name: 'Restart Service', type: 'restart' },
    { id: 'rollback', name: 'Rollback Deployment', type: 'rollback' },
    { id: 'scale', name: 'Scale Resources', type: 'scale' }
  ]
}

async function triggerRecovery(strategyId: string, reason: string, context?: any) {
  return {
    id: 'recovery-' + Date.now(),
    strategyId,
    reason,
    status: 'success',
    timestamp: new Date().toISOString(),
    context
  }
}

async function triggerEscalatedRecovery(reason: string, context?: any) {
  return [
    {
      id: 'escalated-' + Date.now(),
      reason,
      status: 'success',
      timestamp: new Date().toISOString(),
      context
    }
  ]
}

function addCustomRecoveryStrategy(strategy: any) {
  // Stub implementation
  console.log('Adding custom recovery strategy:', strategy)
}

function getDockerContainerStatus() {
  return {
    containers: [],
    total: 0,
    running: 0,
    stopped: 0
  }
}

async function getContainerLogs(containerId: string, lines: number = 100) {
  return {
    containerId,
    logs: [],
    lineCount: 0
  }
}

async function triggerContainerRecovery(containerId: string, strategyId: string) {
  return {
    id: 'container-recovery-' + Date.now(),
    containerId,
    strategyId,
    status: 'success',
    timestamp: new Date().toISOString()
  }
}

async function getContainerPerformance(containerId: string) {
  return {
    containerId,
    cpu: 0,
    memory: 0,
    network: 0,
    disk: 0
  }
}

export async function healthRoutes(fastify: FastifyInstance) {
  // Basic health check endpoint (maintains compatibility)
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    const health = getHealthStatus()
    return reply.code(200).send(health)
  })

  // Enhanced health check endpoint
  fastify.get('/health/enhanced', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const enhancedHealth = await getEnhancedHealthStatus()
      const statusCode = enhancedHealth.ok ? 200 : 503
      return reply.code(statusCode).send(enhancedHealth)
    } catch (error) {
      return reply.code(500).send({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Readiness check endpoint
  fastify.get('/ready', async (request: FastifyRequest, reply: FastifyReply) => {
    const readiness = await getReadinessStatus()
    const statusCode = readiness.ready ? 200 : 503
    
    // Add security warnings if bypass is enabled
    const warnings = []
    if ((process.env.FF_TEST_BYPASS || 'off') === 'on') {
      warnings.push('FF_TEST_BYPASS=on - security bypass enabled!')
    }
    
    const response = {
      ...readiness,
      ...(warnings.length > 0 && { warnings })
    }
    
    return reply.code(statusCode).send(response)
  })

  // Metrics endpoint (Prometheus format)
  fastify.get('/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    const metrics = getMetricsResponse()
    reply.header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
    return reply.code(200).send(metrics)
  })

  // Multi-level monitoring dashboard
  fastify.get('/health/monitoring', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const dashboard = await getMonitoringDashboard()
      return reply.code(200).send(dashboard)
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // System health summary
  fastify.get('/health/system', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const summary = await getSystemHealthSummary()
      
      let statusCode = 200
      if ('overallHealth' in summary) {
        statusCode = summary.overallHealth === 'healthy' ? 200 : 
                    summary.overallHealth === 'degraded' ? 206 : 503
      } else if (!summary.enabled) {
        statusCode = 503
      }
      
      return reply.code(statusCode).send(summary)
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Monitoring statistics
  fastify.get('/health/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await getMonitoringStats()
      return reply.code(200).send(stats)
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Historical metrics data
  fastify.get('/health/history', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any
      const options = {
        level: query.level,
        hours: query.hours ? parseInt(query.hours) : 24,
        limit: query.limit ? parseInt(query.limit) : 100
      }
      
      const history = await getMetricsHistory(options)
      return reply.code(200).send({
        options,
        count: history.length,
        data: history
      })
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Alert management endpoints
  
  // Alert dashboard
  fastify.get('/health/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const dashboard = await getAlertDashboard()
      return reply.code(200).send(dashboard)
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Alert statistics
  fastify.get('/health/alerts/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any
      const hours = query.hours ? parseInt(query.hours) : 24
      const stats = await getAlertStatistics(hours)
      return reply.code(200).send(stats)
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Alert history
  fastify.get('/health/alerts/history', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any
      const options = {
        limit: query.limit ? parseInt(query.limit) : 50,
        level: query.level,
        category: query.category,
        hours: query.hours ? parseInt(query.hours) : 24
      }
      
      const history = await getAlertHistory(options)
      return reply.code(200).send({
        options,
        count: history.length,
        alerts: history
      })
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Create manual alert
  fastify.post('/health/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any
      
      if (!body.title || !body.message || !body.level || !body.category) {
        return reply.code(400).send({
          error: 'Missing required fields: title, message, level, category',
          timestamp: new Date().toISOString()
        })
      }

      const alert = await createManualAlert({
        level: body.level,
        title: body.title,
        message: body.message,
        category: body.category,
        metadata: body.metadata
      })

      return reply.code(201).send(alert)
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Resolve alert
  fastify.post('/health/alerts/:alertId/resolve', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as any
      const body = request.body as any
      
      const resolved = await resolveAlert(params.alertId, body.resolvedBy || 'api-user')
      
      if (!resolved) {
        return reply.code(404).send({
          error: 'Alert not found or already resolved',
          timestamp: new Date().toISOString()
        })
      }

      return reply.code(200).send({
        success: true,
        alertId: params.alertId,
        resolvedBy: body.resolvedBy || 'api-user',
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Acknowledge alert
  fastify.post('/health/alerts/:alertId/acknowledge', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as any
      const body = request.body as any
      
      if (!body.acknowledgedBy) {
        return reply.code(400).send({
          error: 'Missing required field: acknowledgedBy',
          timestamp: new Date().toISOString()
        })
      }

      const acknowledged = await acknowledgeAlert(params.alertId, body.acknowledgedBy)
      
      if (!acknowledged) {
        return reply.code(404).send({
          error: 'Alert not found or already resolved',
          timestamp: new Date().toISOString()
        })
      }

      return reply.code(200).send({
        success: true,
        alertId: params.alertId,
        acknowledgedBy: body.acknowledgedBy,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Test alert system
  fastify.post('/health/alerts/test', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await testAlertSystem()
      return reply.code(200).send(result)
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Graceful degradation endpoints

  // Degradation status
  fastify.get('/health/degradation', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const status = getDegradationStatus()
      let statusCode = 200
      if (status.enabled && 'active' in status && status.active) {
        statusCode = status.level >= 3 ? 503 : status.level >= 2 ? 206 : 200
      }
      return reply.code(statusCode).send(status)
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Degradation metrics
  fastify.get('/health/degradation/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const metrics = getDegradationMetrics()
      return reply.code(200).send(metrics)
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Check feature availability
  fastify.get('/health/degradation/features/:feature', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as any
      const available = isFeatureAvailable(params.feature)
      
      return reply.code(200).send({
        feature: params.feature,
        available,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Force degradation
  fastify.post('/health/degradation/force', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any
      
      if (!body.level || typeof body.level !== 'number') {
        return reply.code(400).send({
          error: 'Missing or invalid required field: level (number)',
          timestamp: new Date().toISOString()
        })
      }

      forceDegradation(body.level, body.reason || 'api-request')
      
      return reply.code(200).send({
        success: true,
        level: body.level,
        reason: body.reason || 'api-request',
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Force recovery
  fastify.post('/health/degradation/recover', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any
      
      forceRecovery(body.reason || 'api-request')
      
      return reply.code(200).send({
        success: true,
        reason: body.reason || 'api-request',
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Emergency actions
  fastify.post('/health/degradation/emergency', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = triggerEmergencyActions()
      return reply.code(200).send(result)
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Test degradation system
  fastify.post('/health/degradation/test', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await testDegradationSystem()
      return reply.code(200).send(result)
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // === RECOVERY CONTROLLER ENDPOINTS ===

  // Get recovery status and statistics
  fastify.get('/health/recovery', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const status = getRecoveryStatus()
      return reply.code(200).send(status)
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Get available recovery strategies
  fastify.get('/health/recovery/strategies', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const strategies = getRecoveryStrategies()
      return reply.code(200).send({
        strategies,
        count: strategies.length
      })
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Trigger manual recovery
  fastify.post('/health/recovery/trigger', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any
      
      if (!body.strategyId || !body.reason) {
        return reply.code(400).send({
          error: 'Missing required fields: strategyId, reason',
          timestamp: new Date().toISOString()
        })
      }

      const attempt = await triggerRecovery(body.strategyId, body.reason, body.context)
      return reply.code(200).send(attempt)
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Trigger escalated recovery
  fastify.post('/health/recovery/escalate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any
      
      if (!body.reason) {
        return reply.code(400).send({
          error: 'Missing required field: reason',
          timestamp: new Date().toISOString()
        })
      }

      const attempts = await triggerEscalatedRecovery(body.reason, body.context)
      return reply.code(200).send({
        attempts,
        count: attempts.length,
        successful: attempts.filter(a => a.status === 'success').length
      })
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Add custom recovery strategy
  fastify.post('/health/recovery/strategies', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any
      
      if (!body.id || !body.name || !body.type || !body.actions) {
        return reply.code(400).send({
          error: 'Missing required fields: id, name, type, actions',
          timestamp: new Date().toISOString()
        })
      }

      addCustomRecoveryStrategy(body)
      return reply.code(201).send({
        message: 'Recovery strategy added successfully',
        strategyId: body.id
      })
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // === DOCKER CONTAINER MANAGEMENT ENDPOINTS ===

  // Get Docker container status
  fastify.get('/health/containers', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const status = getDockerContainerStatus()
      return reply.code(200).send(status)
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Get container logs
  fastify.get('/health/containers/:containerId/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as any
      const query = request.query as any
      
      const lines = query.lines ? parseInt(query.lines) : 100
      const logs = await getContainerLogs(params.containerId, lines)
      
      return reply.code(200).send({
        containerId: params.containerId,
        logs,
        count: logs.lineCount
      })
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Trigger container recovery
  fastify.post('/health/containers/:containerId/recover', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as any
      const body = request.body as any
      
      const attempt = await triggerContainerRecovery(params.containerId, body.strategyId)
      
      return reply.code(200).send(attempt)
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Get container performance metrics
  fastify.get('/health/containers/:containerId/performance', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as any
      
      const performance = await getContainerPerformance(params.containerId)
      
      return reply.code(200).send({
        containerId: params.containerId,
        performance
      })
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })
}
