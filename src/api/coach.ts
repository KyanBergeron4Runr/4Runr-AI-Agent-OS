import { FastifyInstance } from 'fastify'
import { coach } from '../sentinel/coach'
import { sentinelTelemetry } from '../sentinel/telemetry'
import { sentinelEvents } from '../sentinel/telemetry'

export async function coachRoutes(server: FastifyInstance) {
  // GET /coach/report/:agentId - Get Coach analysis report for an agent
  server.get('/coach/report/:agentId', async (request, reply) => {
    try {
      const { agentId } = request.params as { agentId: string }
      const { runCount = 100 } = request.query as { runCount?: number }

      const report = await coach.analyzeAgent(agentId, runCount)

      // Emit coach event
      sentinelEvents.emit('guardEvent', {
        id: `coach-report-${Date.now()}`,
        type: 'coach.report_generated',
        correlationId: agentId,
        agentId,
        timestamp: Date.now(),
        data: {
          reportId: report.agentId,
          proposalCount: report.topProposals.length,
          failureClusterCount: report.failureClusters.length
        }
      })

      return reply.code(200).send({
        success: true,
        data: report,
        timestamp: Date.now()
      })

    } catch (error) {
      console.error('Coach report error:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to generate Coach report'
      })
    }
  })

  // POST /coach/experiment/start - Start an A/B experiment
  server.post('/coach/experiment/start', async (request, reply) => {
    try {
      const { agentId, patchProposal } = request.body as {
        agentId: string
        patchProposal: any
      }

      const experiment = await coach.startABExperiment(agentId, patchProposal)

      // Emit coach event
      sentinelEvents.emit('guardEvent', {
        id: `coach-experiment-start-${Date.now()}`,
        type: 'coach.experiment_started',
        correlationId: experiment.id,
        agentId,
        timestamp: Date.now(),
        data: {
          experimentId: experiment.id,
          patchType: patchProposal.type,
          confidence: patchProposal.confidence
        }
      })

      return reply.code(200).send({
        success: true,
        data: experiment,
        timestamp: Date.now()
      })

    } catch (error) {
      console.error('Coach experiment start error:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to start Coach experiment'
      })
    }
  })

  // POST /coach/experiment/:experimentId/complete - Complete an A/B experiment
  server.post('/coach/experiment/:experimentId/complete', async (request, reply) => {
    try {
      const { experimentId } = request.params as { experimentId: string }
      const { slotAMetrics, slotBMetrics } = request.body as {
        slotAMetrics: any
        slotBMetrics: any
      }

      const experiment = await coach.completeABExperiment(experimentId, slotAMetrics, slotBMetrics)

      // Emit coach event
      sentinelEvents.emit('guardEvent', {
        id: `coach-experiment-complete-${Date.now()}`,
        type: 'coach.experiment_completed',
        correlationId: experimentId,
        agentId: experiment.agentId,
        timestamp: Date.now(),
        data: {
          experimentId,
          winner: experiment.results?.winner,
          passedGates: experiment.results?.passedGates,
          groundednessImprovement: experiment.results ? 
            experiment.results.slotB.meanGroundedness - experiment.results.slotA.meanGroundedness : 0
        }
      })

      return reply.code(200).send({
        success: true,
        data: experiment,
        timestamp: Date.now()
      })

    } catch (error) {
      console.error('Coach experiment complete error:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to complete Coach experiment'
      })
    }
  })

  // GET /coach/experiment/:experimentId - Get experiment status
  server.get('/coach/experiment/:experimentId', async (request, reply) => {
    try {
      const { experimentId } = request.params as { experimentId: string }

      const experiment = coach.getExperiment(experimentId)
      if (!experiment) {
        return reply.code(404).send({
          success: false,
          error: 'Experiment not found'
        })
      }

      return reply.code(200).send({
        success: true,
        data: experiment,
        timestamp: Date.now()
      })

    } catch (error) {
      console.error('Coach experiment get error:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to get Coach experiment'
      })
    }
  })

  // GET /coach/experiments/:agentId - Get all experiments for an agent
  server.get('/coach/experiments/:agentId', async (request, reply) => {
    try {
      const { agentId } = request.params as { agentId: string }

      const experiments = coach.getAgentExperiments(agentId)

      return reply.code(200).send({
        success: true,
        data: {
          agentId,
          experiments,
          count: experiments.length
        },
        timestamp: Date.now()
      })

    } catch (error) {
      console.error('Coach experiments get error:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to get Coach experiments'
      })
    }
  })

  // GET /coach/rollback/:agentId - Rollback to slot A
  server.get('/coach/rollback/:agentId', async (request, reply) => {
    try {
      const { agentId } = request.params as { agentId: string }

      await coach.rollbackToSlotA(agentId)

      // Emit coach event
      sentinelEvents.emit('guardEvent', {
        id: `coach-rollback-${Date.now()}`,
        type: 'coach.rollback_applied',
        correlationId: agentId,
        agentId,
        timestamp: Date.now(),
        data: {
          action: 'rollback_to_slot_a',
          agentId
        }
      })

      return reply.code(200).send({
        success: true,
        message: 'Successfully rolled back to slot A',
        data: { agentId },
        timestamp: Date.now()
      })

    } catch (error) {
      console.error('Coach rollback error:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to rollback Coach configuration'
      })
    }
  })

  // POST /coach/route/:agentId/:experimentId - Route a run to A or B slot
  server.post('/coach/route/:agentId/:experimentId', async (request, reply) => {
    try {
      const { agentId, experimentId } = request.params as { agentId: string; experimentId: string }

      const slot = coach.routeRun(agentId, experimentId)

      return reply.code(200).send({
        success: true,
        data: {
          agentId,
          experimentId,
          slot,
          timestamp: Date.now()
        }
      })

    } catch (error) {
      console.error('Coach route error:', error)
      return reply.code(500).send({
        success: false,
        error: 'Failed to route run'
      })
    }
  })

  // GET /coach/health - Coach system health check
  server.get('/coach/health', async (request, reply) => {
    try {
      const telemetryData = sentinelTelemetry.getAllTelemetryData()
      
      const health = {
        status: 'healthy',
        features: {
          analysis: true,
          abTesting: true,
          rollback: true
        },
        metrics: {
          totalExperiments: Array.from(coach['experiments'].values()).length,
          activeExperiments: Array.from(coach['experiments'].values()).filter(e => e.status === 'running').length,
          totalAgents: coach['agentSlots'].size
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
      console.error('Coach health check error:', error)
      return reply.code(500).send({
        success: false,
        error: 'Coach health check failed'
      })
    }
  })
}
