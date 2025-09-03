import { sentinelTelemetry } from './telemetry'
import { sentinelConfig } from './config'
import { judge } from './judge'
import crypto from 'crypto'

export interface PatchProposal {
  id: string
  type: 'prompt' | 'policy' | 'retrieval'
  diff: string
  expectedEffect: {
    groundedness: number
    citationCoverage: number
    shieldActionRate: number
    latency: number
    cost: number
  }
  confidence: number
  evidence: {
    failurePatterns: string[]
    exampleRunIds: string[]
    frequency: number
    severity: 'low' | 'medium' | 'high'
  }
  createdAt: Date
}

export interface CoachReport {
  agentId: string
  analysisPeriod: {
    start: Date
    end: Date
    runCount: number
  }
  currentMetrics: {
    meanGroundedness: number
    meanCitationCoverage: number
    shieldActionRate: number
    avgLatency: number
    avgCost: number
  }
  topProposals: PatchProposal[]
  failureClusters: {
    pattern: string
    frequency: number
    severity: 'low' | 'medium' | 'high'
    exampleRuns: string[]
  }[]
}

export interface ABExperiment {
  id: string
  agentId: string
  patchProposal: PatchProposal
  status: 'running' | 'completed' | 'failed'
  startTime: Date
  endTime?: Date
  results?: {
    slotA: ABMetrics
    slotB: ABMetrics
    winner: 'A' | 'B' | 'tie'
    passedGates: boolean
  }
  routingConfig: {
    slotARatio: number
    slotBRatio: number
  }
}

export interface ABMetrics {
  runCount: number
  meanGroundedness: number
  meanCitationCoverage: number
  shieldActionRate: number
  avgLatency: number
  avgCost: number
  numericMismatches: number
}

export class Coach {
  private experiments: Map<string, ABExperiment> = new Map()
  private agentSlots: Map<string, { slotA: any; slotB: any; currentSlot: 'A' | 'B' }> = new Map()

  /**
   * Analyze past runs for an agent and generate improvement recommendations
   */
  async analyzeAgent(agentId: string, runCount: number = 100): Promise<CoachReport> {
    const telemetryData = sentinelTelemetry.getAllTelemetryData()
    
    // Get recent runs for this agent
    const agentRuns = telemetryData.spans
      .filter(span => span.agentId === agentId)
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, runCount)

    // Get associated events and verdicts
    const runIds = agentRuns.map(run => run.correlationId)
    const events = telemetryData.events.filter(event => runIds.includes(event.correlationId))
    const verdicts = telemetryData.verdicts.filter(verdict => runIds.includes(verdict.correlationId))

    // Calculate current metrics
    const currentMetrics = this.calculateCurrentMetrics(agentRuns, events, verdicts)

    // Find failure patterns
    const failureClusters = this.findFailurePatterns(agentRuns, events, verdicts)

    // Generate patch proposals
    const proposals = await this.generatePatchProposals(agentId, failureClusters, currentMetrics)

    return {
      agentId,
      analysisPeriod: {
        start: new Date(Math.min(...agentRuns.map(r => r.startTime))),
        end: new Date(Math.max(...agentRuns.map(r => r.startTime))),
        runCount: agentRuns.length
      },
      currentMetrics,
      topProposals: proposals.slice(0, 3), // Top 3 proposals
      failureClusters
    }
  }

  /**
   * Calculate current performance metrics
   */
  private calculateCurrentMetrics(runs: any[], events: any[], verdicts: any[]): any {
    const groundednessScores = verdicts.map(v => v.verdict.groundedness).filter(s => s !== undefined)
    const citationScores = verdicts.map(v => v.verdict.citationCoverage).filter(s => s !== undefined)
    
    const shieldEvents = events.filter(e => e.type === 'shield_decision')
    const totalRuns = runs.length

    return {
      meanGroundedness: groundednessScores.length > 0 ? 
        groundednessScores.reduce((a, b) => a + b, 0) / groundednessScores.length : 0,
      meanCitationCoverage: citationScores.length > 0 ? 
        citationScores.reduce((a, b) => a + b, 0) / citationScores.length : 0,
      shieldActionRate: totalRuns > 0 ? shieldEvents.length / totalRuns : 0,
      avgLatency: runs.length > 0 ? 
        runs.reduce((sum, run) => sum + (run.endTime - run.startTime), 0) / runs.length : 0,
      avgCost: runs.length > 0 ? 
        runs.reduce((sum, run) => sum + (run.tokenUsage || 0), 0) / runs.length : 0
    }
  }

  /**
   * Find failure patterns in the runs
   */
  private findFailurePatterns(runs: any[], events: any[], verdicts: any[]): any[] {
    const patterns: any[] = []

    // Low groundedness pattern
    const lowGroundednessRuns = verdicts
      .filter(v => v.verdict.groundedness < 0.6)
      .map(v => v.correlationId)
    
    if (lowGroundednessRuns.length > 0) {
      patterns.push({
        pattern: 'Low groundedness (< 0.6)',
        frequency: lowGroundednessRuns.length,
        severity: lowGroundednessRuns.length > runs.length * 0.3 ? 'high' : 'medium',
        exampleRuns: lowGroundednessRuns.slice(0, 5)
      })
    }

    // Injection detection pattern
    const injectionEvents = events.filter(e => e.type === 'injection_detected')
    if (injectionEvents.length > 0) {
      patterns.push({
        pattern: 'Prompt injection attempts',
        frequency: injectionEvents.length,
        severity: injectionEvents.length > runs.length * 0.1 ? 'high' : 'medium',
        exampleRuns: [...new Set(injectionEvents.map(e => e.correlationId))].slice(0, 5)
      })
    }

    // PII masking pattern
    const piiEvents = events.filter(e => e.type === 'pii_masked')
    if (piiEvents.length > 0) {
      patterns.push({
        pattern: 'PII content detected and masked',
        frequency: piiEvents.length,
        severity: piiEvents.length > runs.length * 0.2 ? 'high' : 'medium',
        exampleRuns: [...new Set(piiEvents.map(e => e.correlationId))].slice(0, 5)
      })
    }

    // High latency pattern
    const highLatencyRuns = runs.filter(r => (r.endTime - r.startTime) > 5000) // > 5 seconds
    if (highLatencyRuns.length > 0) {
      patterns.push({
        pattern: 'High latency (> 5s)',
        frequency: highLatencyRuns.length,
        severity: highLatencyRuns.length > runs.length * 0.2 ? 'high' : 'medium',
        exampleRuns: highLatencyRuns.map(r => r.correlationId).slice(0, 5)
      })
    }

    return patterns
  }

  /**
   * Generate patch proposals based on failure patterns
   */
  private async generatePatchProposals(agentId: string, failureClusters: any[], currentMetrics: any): Promise<PatchProposal[]> {
    const proposals: PatchProposal[] = []

    // Generate prompt improvements for low groundedness
    const lowGroundednessPattern = failureClusters.find(p => p.pattern.includes('Low groundedness'))
    if (lowGroundednessPattern) {
      proposals.push({
        id: crypto.randomUUID(),
        type: 'prompt',
        diff: `Add to system prompt:
- "Only state facts that are explicitly supported by the provided evidence"
- "For each claim, include a citation reference like [Source1]"
- "If information is not available in the evidence, state 'data unavailable'"
- "Lower temperature from 0.8 to 0.3 for more focused responses"`,
        expectedEffect: {
          groundedness: currentMetrics.meanGroundedness + 0.15,
          citationCoverage: currentMetrics.meanCitationCoverage + 0.20,
          shieldActionRate: Math.max(0, currentMetrics.shieldActionRate - 0.1),
          latency: currentMetrics.avgLatency * 0.9,
          cost: currentMetrics.avgCost * 0.95
        },
        confidence: 0.8,
        evidence: {
          failurePatterns: ['Low groundedness responses'],
          exampleRunIds: lowGroundednessPattern.exampleRuns,
          frequency: lowGroundednessPattern.frequency,
          severity: lowGroundednessPattern.severity
        },
        createdAt: new Date()
      })
    }

    // Generate policy improvements for injection attempts
    const injectionPattern = failureClusters.find(p => p.pattern.includes('injection'))
    if (injectionPattern) {
      proposals.push({
        id: crypto.randomUUID(),
        type: 'policy',
        diff: `Update Shield policy:
- Increase injection detection sensitivity from 'medium' to 'high'
- Add pattern: "ignore previous instructions" → block
- Add pattern: "you are now" → require_approval
- Add pattern: "system prompt" → flag`,
        expectedEffect: {
          groundedness: currentMetrics.meanGroundedness,
          citationCoverage: currentMetrics.meanCitationCoverage,
          shieldActionRate: currentMetrics.shieldActionRate + 0.05,
          latency: currentMetrics.avgLatency * 1.02,
          cost: currentMetrics.avgCost
        },
        confidence: 0.9,
        evidence: {
          failurePatterns: ['Prompt injection attempts'],
          exampleRunIds: injectionPattern.exampleRuns,
          frequency: injectionPattern.frequency,
          severity: injectionPattern.severity
        },
        createdAt: new Date()
      })
    }

    // Generate retrieval improvements for low citation coverage
    if (currentMetrics.meanCitationCoverage < 0.5) {
      proposals.push({
        id: crypto.randomUUID(),
        type: 'retrieval',
        diff: `Update retrieval strategy:
- Increase top-k from 5 to 8 for broader context
- Add source priority: prioritize recent/authoritative sources
- Add content filtering: prefer sources with metrics/numbers
- Add retrieval prompt: "Extract key metrics and facts before composing response"`,
        expectedEffect: {
          groundedness: currentMetrics.meanGroundedness + 0.10,
          citationCoverage: currentMetrics.meanCitationCoverage + 0.25,
          shieldActionRate: Math.max(0, currentMetrics.shieldActionRate - 0.05),
          latency: currentMetrics.avgLatency * 1.1,
          cost: currentMetrics.avgCost * 1.05
        },
        confidence: 0.7,
        evidence: {
          failurePatterns: ['Low citation coverage'],
          exampleRunIds: [],
          frequency: Math.floor(failureClusters.length * 0.6),
          severity: 'medium'
        },
        createdAt: new Date()
      })
    }

    return proposals.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * Start an A/B experiment with a patch proposal
   */
  async startABExperiment(agentId: string, patchProposal: PatchProposal): Promise<ABExperiment> {
    const experimentId = crypto.randomUUID()
    
    // Initialize agent slots if not exists
    if (!this.agentSlots.has(agentId)) {
      const currentConfig = sentinelConfig.getConfig()
      this.agentSlots.set(agentId, {
        slotA: { ...currentConfig },
        slotB: { ...currentConfig },
        currentSlot: 'A'
      })
    }

    const experiment: ABExperiment = {
      id: experimentId,
      agentId,
      patchProposal,
      status: 'running',
      startTime: new Date(),
      routingConfig: {
        slotARatio: 0.5,
        slotBRatio: 0.5
      }
    }

    this.experiments.set(experimentId, experiment)
    
    // Apply patch to slot B
    await this.applyPatchToSlot(agentId, 'B', patchProposal)

    return experiment
  }

  /**
   * Apply a patch to a specific slot
   */
  private async applyPatchToSlot(agentId: string, slot: 'A' | 'B', patch: PatchProposal): Promise<void> {
    const agentSlot = this.agentSlots.get(agentId)
    if (!agentSlot) return

    // Apply the patch based on type
    switch (patch.type) {
      case 'prompt':
        // Update system prompt (simplified - in real implementation would parse diff)
        agentSlot[`slot${slot}`].systemPrompt = patch.diff
        break
      case 'policy':
        // Update Shield policies
        agentSlot[`slot${slot}`].shield = {
          ...agentSlot[`slot${slot}`].shield,
          injectionSensitivity: 'high'
        }
        break
      case 'retrieval':
        // Update retrieval config
        agentSlot[`slot${slot}`].retrieval = {
          ...agentSlot[`slot${slot}`].retrieval,
          topK: 8,
          sourcePriority: true
        }
        break
    }
  }

  /**
   * Route a run to either slot A or B based on experiment configuration
   */
  routeRun(agentId: string, experimentId: string): 'A' | 'B' {
    const experiment = this.experiments.get(experimentId)
    if (!experiment || experiment.status !== 'running') return 'A'

    // Simple 50/50 routing based on run ID hash
    const runHash = crypto.createHash('md5').update(experimentId + Date.now()).digest('hex')
    const hashValue = parseInt(runHash.substring(0, 8), 16)
    
    return (hashValue % 100) < 50 ? 'A' : 'B'
  }

  /**
   * Complete an A/B experiment and determine winner
   */
  async completeABExperiment(experimentId: string, slotAMetrics: ABMetrics, slotBMetrics: ABMetrics): Promise<ABExperiment> {
    const experiment = this.experiments.get(experimentId)
    if (!experiment) throw new Error('Experiment not found')

    // Determine winner based on pass/fail criteria
    const groundednessImprovement = slotBMetrics.meanGroundedness - slotAMetrics.meanGroundedness
    const coverageImprovement = slotBMetrics.meanCitationCoverage - slotAMetrics.meanCitationCoverage
    const shieldRateChange = slotBMetrics.shieldActionRate - slotAMetrics.shieldActionRate
    const latencyChange = (slotBMetrics.avgLatency - slotAMetrics.avgLatency) / slotAMetrics.avgLatency
    const mismatchReduction = slotAMetrics.numericMismatches > 0 ? 
      (slotAMetrics.numericMismatches - slotBMetrics.numericMismatches) / slotAMetrics.numericMismatches : 0

    // Check pass/fail gates
    const passedGates = 
      groundednessImprovement >= 0.10 &&
      coverageImprovement >= 0.10 &&
      shieldRateChange <= 0 &&
      latencyChange <= 0.10 &&
      mismatchReduction >= 0.8

    const winner = passedGates ? 'B' : 'A'

    experiment.status = 'completed'
    experiment.endTime = new Date()
    experiment.results = {
      slotA: slotAMetrics,
      slotB: slotBMetrics,
      winner,
      passedGates
    }

    // If B wins, promote it to default
    if (winner === 'B') {
      await this.promoteSlotB(experiment.agentId)
    }

    return experiment
  }

  /**
   * Promote slot B to be the default configuration
   */
  private async promoteSlotB(agentId: string): Promise<void> {
    const agentSlot = this.agentSlots.get(agentId)
    if (!agentSlot) return

    agentSlot.slotA = { ...agentSlot.slotB }
    agentSlot.currentSlot = 'B'

    // Update the actual configuration
    sentinelConfig.updateConfig(agentSlot.slotB)
  }

  /**
   * Rollback to slot A (revert changes)
   */
  async rollbackToSlotA(agentId: string): Promise<void> {
    const agentSlot = this.agentSlots.get(agentId)
    if (!agentSlot) return

    agentSlot.currentSlot = 'A'
    sentinelConfig.updateConfig(agentSlot.slotA)
  }

  /**
   * Get current experiment status
   */
  getExperiment(experimentId: string): ABExperiment | undefined {
    return this.experiments.get(experimentId)
  }

  /**
   * Get all experiments for an agent
   */
  getAgentExperiments(agentId: string): ABExperiment[] {
    return Array.from(this.experiments.values()).filter(e => e.agentId === agentId)
  }
}

export const coach = new Coach()
