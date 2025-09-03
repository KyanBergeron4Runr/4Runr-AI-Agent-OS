import { FastifyInstance } from 'fastify'
import { sentinelTelemetry, sentinelEvents } from '../sentinel/telemetry'
import { sentinelConfig } from '../sentinel/config'
import { hallucinationDetector } from '../sentinel/hallucination'
import { injectionDetector } from '../sentinel/injection'
import { judge } from '../sentinel/judge'
import { Evidence } from '../sentinel/types'
import crypto from 'crypto'

export async function sentinelRoutes(server: FastifyInstance) {
  // GET /sentinel/metrics - Get Sentinel metrics (Developer View)
  server.get('/sentinel/metrics', async (request, reply) => {
    try {
      const telemetryData = sentinelTelemetry.getAllTelemetryData()
      const config = sentinelConfig.getConfig()

      const metrics = {
        // Core metrics
        totalSpans: telemetryData.metrics.totalSpans,
        totalEvents: telemetryData.metrics.totalEvents,
        totalVerdicts: telemetryData.metrics.totalVerdicts,
        avgLatency: Math.round(telemetryData.metrics.avgLatency),
        totalTokenUsage: telemetryData.metrics.totalTokenUsage,

        // Safety metrics
        flaggedHallucinations: telemetryData.metrics.flaggedHallucinations,
        flaggedInjections: telemetryData.metrics.flaggedInjections,
        flaggedPII: telemetryData.metrics.flaggedPII,
        lowGroundednessCount: telemetryData.metrics.lowGroundednessCount,
        judgeErrors: telemetryData.metrics.judgeErrors,

        // Configuration status
        features: {
          telemetry: config.telemetry.enabled,
          hallucination: config.hallucination.enabled,
          injection: config.injection.enabled,
          pii: config.pii.enabled,
          cost: config.cost.enabled,
          latency: config.latency.enabled,
          judge: config.judge.enabled
        },

        // Recent activity (last 100 events)
        recentEvents: telemetryData.events
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 100)
          .map(event => ({
            id: event.id,
            type: event.type,
            severity: event.severity,
            timestamp: event.timestamp,
            agentId: event.agentId,
            action: event.action,
            resolved: event.resolved
          })),

        // System status
        system: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          configPath: process.env.SENTINEL_CONFIG_PATH || 'default'
        }
      }

      return reply.code(200).send({
        success: true,
        data: metrics,
        timestamp: Date.now()
      })

    } catch (error) {
      console.error('Sentinel metrics error:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve Sentinel metrics'
      })
    }
  })

  // GET /sentinel/telemetry/:correlationId - Get telemetry data for specific correlation
  server.get('/sentinel/telemetry/:correlationId', async (request, reply) => {
    try {
      const { correlationId } = request.params as { correlationId: string }
      
      const telemetryData = sentinelTelemetry.getTelemetryData(correlationId)

      return reply.code(200).send({
        success: true,
        data: telemetryData,
        correlationId,
        timestamp: Date.now()
      })

    } catch (error) {
      console.error('Sentinel telemetry error:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve telemetry data'
      })
    }
  })

  // GET /sentinel/events/stream - Real-time GuardEvent SSE stream
  server.get('/sentinel/events/stream', async (request, reply) => {
    try {
      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      })

      // Send initial connection message
      reply.raw.write(`data: ${JSON.stringify({
        type: 'connection',
        message: 'Sentinel GuardEvent stream connected',
        timestamp: Date.now()
      })}\n\n`)

      // Set up event listener
      const eventHandler = (guardEvent: any) => {
        const eventData = {
          id: guardEvent.id,
          type: guardEvent.type,
          correlationId: guardEvent.correlationId,
          agentId: guardEvent.agentId,
          timestamp: guardEvent.timestamp,
          data: guardEvent.data
        }

        reply.raw.write(`data: ${JSON.stringify(eventData)}\n\n`)
      }

      // Add event listener
      sentinelEvents.on('guardEvent', eventHandler)

      // Handle client disconnect
      request.raw.on('close', () => {
        sentinelEvents.off('guardEvent', eventHandler)
        console.log('Sentinel SSE client disconnected')
      })

      // Keep connection alive
      const keepAlive = setInterval(() => {
        if (reply.raw.destroyed) {
          clearInterval(keepAlive)
          return
        }
        reply.raw.write(': keepalive\n\n')
      }, 30000) // Send keepalive every 30 seconds

      // Clean up on disconnect
      request.raw.on('close', () => {
        clearInterval(keepAlive)
      })

    } catch (error) {
      console.error('Sentinel SSE error:', error)
      if (!reply.sent) {
        return reply.code(500).send({
          success: false,
          error: 'Failed to establish SSE connection'
        })
      }
    }
  })

  // POST /sentinel/test/hallucination - Test hallucination detection
  server.post('/sentinel/test/hallucination', async (request, reply) => {
    try {
      const { input, output, correlationId = 'test', agentId = 'test-agent', spanId = 'test-span' } = request.body as any

      const check = hallucinationDetector.checkForHallucination(
        correlationId,
        agentId,
        spanId,
        input,
        output
      )

      return reply.code(200).send({
        success: true,
        data: {
          check,
          input: typeof input === 'string' ? input.substring(0, 200) + '...' : input,
          output: typeof output === 'string' ? output.substring(0, 200) + '...' : output
        }
      })

    } catch (error) {
      console.error('Hallucination test error:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to test hallucination detection'
      })
    }
  })

  // POST /sentinel/test/injection - Test injection detection
  server.post('/sentinel/test/injection', async (request, reply) => {
    try {
      const { input, correlationId = 'test', agentId = 'test-agent', spanId = 'test-span' } = request.body as any

      const check = injectionDetector.checkForInjection(
        correlationId,
        agentId,
        spanId,
        input
      )

      return reply.code(200).send({
        success: true,
        data: {
          check,
          input: typeof input === 'string' ? input.substring(0, 200) + '...' : input,
          sanitizedInput: check?.sanitizedInput
        }
      })

    } catch (error) {
      console.error('Injection test error:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to test injection detection'
      })
    }
  })

  // POST /sentinel/test/judge - Test Judge groundedness and citation coverage
  server.post('/sentinel/test/judge', async (request, reply) => {
    try {
      const { 
        output, 
        evidence, 
        correlationId = 'test', 
        agentId = 'test-agent', 
        spanId = 'test-span',
        promptMetadata = {}
      } = request.body as any

      const judgeResult = await judge.judgeOutput(
        correlationId,
        agentId,
        spanId,
        output,
        evidence || [],
        promptMetadata
      )

      return reply.code(200).send({
        success: true,
        data: {
          verdict: judgeResult.verdict,
          guardEventEmitted: judgeResult.guardEventEmitted,
          output: typeof output === 'string' ? output.substring(0, 200) + '...' : output,
          evidenceCount: evidence?.length || 0
        }
      })

    } catch (error) {
      console.error('Judge test error:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to test Judge groundedness detection'
      })
    }
  })

  // POST /sentinel/test/shield - Test Shield real-time protection
  server.post('/sentinel/test/shield', async (request, reply) => {
    try {
      const { 
        input, 
        output, 
        correlationId = 'test', 
        agentId = 'test-agent', 
        spanId = 'test-span' 
      } = request.body as any

      // Import Shield dynamically to avoid circular dependencies
      const { Shield } = await import('../sentinel/shield')
      const shield = Shield.getInstance()

      // Create a mock verdict for testing
      const mockVerdict = {
        groundedness: 0.5,
        citationCoverage: 0.3
      }

      // Create mock events for testing
      const mockEvents: any[] = []

      const shieldDecision = await shield.evaluateOutput(
        correlationId,
        agentId,
        spanId,
        output,
        mockVerdict,
        mockEvents,
        {
          externalAction: false,
          cost: 100,
          latency: 1500
        }
      )

      return reply.code(200).send({
        success: true,
        data: {
          decision: shieldDecision,
          input: typeof input === 'string' ? input.substring(0, 200) + '...' : input,
          output: typeof output === 'string' ? output.substring(0, 200) + '...' : output
        }
      })

    } catch (error) {
      console.error('Shield test error:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to test Shield protection'
      })
    }
  })

  // GET /sentinel/verdicts/:correlationId - Get verdicts for a correlation ID
  server.get('/sentinel/verdicts/:correlationId', async (request, reply) => {
    try {
      const { correlationId } = request.params as { correlationId: string }
      
      const telemetryData = sentinelTelemetry.getTelemetryData(correlationId)
      const verdicts = telemetryData.verdicts.sort((a, b) => b.timestamp - a.timestamp)

      return reply.code(200).send({
        success: true,
        data: {
          verdicts,
          count: verdicts.length,
          correlationId
        },
        timestamp: Date.now()
      })

    } catch (error) {
      console.error('Sentinel verdicts error:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve verdicts'
      })
    }
  })

  // GET /sentinel/evidence/:correlationId - Get evidence for a correlation ID
  server.get('/sentinel/evidence/:correlationId', async (request, reply) => {
    try {
      const { correlationId } = request.params as { correlationId: string }
      
      const telemetryData = sentinelTelemetry.getTelemetryData(correlationId)
      const evidence = telemetryData.evidence.sort((a, b) => b.timestamp - a.timestamp)

      return reply.code(200).send({
        success: true,
        data: {
          evidence,
          count: evidence.length,
          correlationId
        },
        timestamp: Date.now()
      })

    } catch (error) {
      console.error('Sentinel evidence error:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve evidence'
      })
    }
  })

  // GET /sentinel/config - Get current Sentinel configuration
  server.get('/sentinel/config', async (request, reply) => {
    try {
      const config = sentinelConfig.getConfig()

      return reply.code(200).send({
        success: true,
        data: config,
        timestamp: Date.now()
      })

    } catch (error) {
      console.error('Sentinel config error:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve Sentinel configuration'
      })
    }
  })

  // PUT /sentinel/config - Update Sentinel configuration
  server.put('/sentinel/config', async (request, reply) => {
    try {
      const newConfig = request.body as any
      
      sentinelConfig.updateConfig(newConfig)

      return reply.code(200).send({
        success: true,
        message: 'Sentinel configuration updated successfully',
        timestamp: Date.now()
      })

    } catch (error) {
      console.error('Sentinel config update error:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to update Sentinel configuration'
      })
    }
  })

  // POST /sentinel/events/:eventId/resolve - Resolve a safety event
  server.post('/sentinel/events/:eventId/resolve', async (request, reply) => {
    try {
      const { eventId } = request.params as { eventId: string }
      const { resolvedBy = 'manual' } = request.body as any

      sentinelTelemetry.resolveEvent(eventId, resolvedBy)

      return reply.code(200).send({
        success: true,
        message: 'Event resolved successfully',
        eventId,
        resolvedBy,
        timestamp: Date.now()
      })

    } catch (error) {
      console.error('Event resolve error:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to resolve event'
      })
    }
  })

  // GET /sentinel/health - Sentinel system health check
  server.get('/sentinel/health', async (request, reply) => {
    try {
      const config = sentinelConfig.getConfig()
      const telemetryData = sentinelTelemetry.getAllTelemetryData()

      const health = {
        status: 'healthy',
        features: {
          telemetry: config.telemetry.enabled,
          hallucination: config.hallucination.enabled,
          injection: config.injection.enabled,
          pii: config.pii.enabled,
          cost: config.cost.enabled,
          latency: config.latency.enabled,
          judge: config.judge.enabled
        },
        metrics: {
          activeSpans: telemetryData.spans.filter(s => !s.endTime).length,
          totalEvents: telemetryData.events.length,
          totalVerdicts: telemetryData.verdicts.length,
          totalEvidence: telemetryData.evidence.length,
          unresolvedEvents: telemetryData.events.filter(e => !e.resolved).length
        },
        system: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          nodeVersion: process.version
        }
      }

      return reply.code(200).send({
        success: true,
        data: health,
        timestamp: Date.now()
      })

    } catch (error) {
      console.error('Sentinel health check error:', error)
      return reply.code(500).send({
        success: false,
        error: 'Sentinel health check failed'
      })
    }
  })
}
