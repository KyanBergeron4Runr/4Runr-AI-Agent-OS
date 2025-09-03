import { sentinelTelemetry } from './telemetry'
import { sentinelConfig } from './config'
import { Judge } from './judge'
import { ShieldDecision, AuditEvent } from './types'
import crypto from 'crypto'

// Types for Shield system
export interface ShieldPolicy {
  id: string
  priority: number
  continue: boolean
  conditions: ShieldConditions
  action: ShieldAction
  params: Record<string, any>
}

export interface ShieldConditions {
  groundedness?: { min?: number; max?: number }
  citation_coverage?: { min?: number; max?: number }
  injection_detected?: boolean
  pii_found?: { length?: { min?: number; max?: number } }
  external_action?: boolean
  cost?: { min?: number; max?: number }
  latency?: { min?: number; max?: number }
  hallucination_severity?: { min?: number; max?: number }
}

export interface ShieldAction {
  type: 'allow' | 'mask' | 'rewrite' | 'require_approval' | 'block' | 'flag'
  params?: Record<string, any>
}



export interface ShieldConfig {
  enabled: boolean
  mode: 'off' | 'monitor' | 'enforce'
  defaultAction: string
  hotReloadInterval: number
  performance: {
    maxDecisionTimeMs: number
    rewriteMaxAttempts: number
    rewriteLatencyBudgetMs: number
    rewriteTemperature: number
  }
  privacy: {
    redactionToken: string
    storePlainText: boolean
    maskPatterns: Record<string, string>
  }
  policies: ShieldPolicy[]
  actions: Record<string, any>
  audit: {
    enabled: boolean
    storeDecisions: boolean
    storeDiffs: boolean
    privacyMode: string
    retentionDays: number
  }
  failureBehavior: {
    defaultAction: string
    externalSinkDefault: string
    internalSinkDefault: string
    logErrors: boolean
  }
}



export class Shield {
  private static instance: Shield
  private config: ShieldConfig
  private judge: Judge
  private lastConfigLoad: number = 0
  private configReloadTimer?: NodeJS.Timeout

  private constructor() {
    this.config = this.loadConfig()
    this.judge = new Judge()
    this.startConfigReload()
  }

  public static getInstance(): Shield {
    if (!Shield.instance) {
      Shield.instance = new Shield()
    }
    return Shield.instance
  }

  private loadConfig(): ShieldConfig {
    try {
      const fs = require('fs')
      const path = require('path')
      const configPath = path.join(process.cwd(), 'config', 'shield.json')
      
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8')
        const config = JSON.parse(configData)
        this.lastConfigLoad = Date.now()
        console.log('🛡️ Shield config loaded successfully')
        return config
      } else {
        console.warn('⚠️ Shield config not found, using defaults')
        return this.getDefaultConfig()
      }
    } catch (error) {
      console.error('❌ Error loading Shield config:', error)
      return this.getDefaultConfig()
    }
  }

  private getDefaultConfig(): ShieldConfig {
    return {
      enabled: true,
      mode: 'enforce',
      defaultAction: 'block',
      hotReloadInterval: 5000,
      performance: {
        maxDecisionTimeMs: 200,
        rewriteMaxAttempts: 1,
        rewriteLatencyBudgetMs: 150,
        rewriteTemperature: 0.3
      },
      privacy: {
        redactionToken: '[REDACTED:{type}]',
        storePlainText: true,
        maskPatterns: {}
      },
      policies: [],
      actions: {},
      audit: {
        enabled: true,
        storeDecisions: true,
        storeDiffs: true,
        privacyMode: 'hash',
        retentionDays: 30
      },
      failureBehavior: {
        defaultAction: 'block',
        externalSinkDefault: 'block',
        internalSinkDefault: 'allow',
        logErrors: true
      }
    }
  }

  private startConfigReload(): void {
    if (this.config.hotReloadInterval > 0) {
      this.configReloadTimer = setInterval(() => {
        this.reloadConfig()
      }, this.config.hotReloadInterval)
    }
  }

  private reloadConfig(): void {
    try {
      const fs = require('fs')
      const path = require('path')
      const configPath = path.join(process.cwd(), 'config', 'shield.json')
      
      if (fs.existsSync(configPath)) {
        const stats = fs.statSync(configPath)
        if (stats.mtime.getTime() > this.lastConfigLoad) {
          this.config = this.loadConfig()
          console.log('🔄 Shield config reloaded')
        }
      }
    } catch (error) {
      console.error('❌ Error reloading Shield config:', error)
    }
  }

  public async evaluateOutput(
    correlationId: string,
    agentId: string,
    spanId: string,
    output: any,
    verdict: any,
    events: any[] = [],
    context: {
      externalAction?: boolean
      sink?: string
      cost?: number
      latency?: number
    } = {}
  ): Promise<ShieldDecision> {
    const startTime = Date.now()
    
    try {
      // Check if Shield is enabled
      if (!this.config.enabled) {
        return this.createAllowDecision(correlationId, agentId, spanId, output, 'Shield disabled')
      }

      // Gather context for policy evaluation
      const evaluationContext = this.buildEvaluationContext(verdict, events, context)
      
      // Evaluate policies in priority order
      const matchedPolicy = this.evaluatePolicies(evaluationContext)
      
      if (!matchedPolicy) {
        return this.createAllowDecision(correlationId, agentId, spanId, output, 'No policy matched')
      }

      // Execute the action based on mode
      const decision = await this.executeAction(
        correlationId,
        agentId,
        spanId,
        output,
        matchedPolicy,
        evaluationContext,
        startTime
      )

      // Store decision and emit audit event
      this.storeDecision(decision)
      this.emitAuditEvent(decision)

      return decision

    } catch (error) {
      console.error('❌ Shield evaluation error:', error)
      
      // Default to safe behavior on error
      const defaultAction = context.externalAction 
        ? this.config.failureBehavior.externalSinkDefault 
        : this.config.failureBehavior.internalSinkDefault

              const decision = this.createDecision(
          correlationId,
          agentId,
          spanId,
          output,
          defaultAction as 'block' | 'mask' | 'rewrite' | 'pass',
          'shield_error',
          Date.now() - startTime
        )

      this.storeDecision(decision)
      this.emitAuditEvent(decision)

      return decision
    }
  }

  private buildEvaluationContext(verdict: any, events: any[], context: any): Record<string, any> {
    const evaluationContext: Record<string, any> = {
      groundedness: verdict?.groundedness || 0,
      citation_coverage: verdict?.citationCoverage || 0,
      injection_detected: false,
      pii_found: [],
      external_action: context.externalAction || false,
      cost: context.cost || 0,
      latency: context.latency || 0,
      hallucination_severity: 0
    }

    // Process events to extract context
    for (const event of events) {
      if (event.type === 'injection_detected') {
        evaluationContext.injection_detected = true
      } else if (event.type === 'pii_detected') {
        evaluationContext.pii_found = event.details?.patterns || []
      } else if (event.type === 'hallucination_detected') {
        evaluationContext.hallucination_severity = event.details?.severity || 0
      }
    }

    return evaluationContext
  }

  private evaluatePolicies(context: Record<string, any>): ShieldPolicy | null {
    // Sort policies by priority (lower number = higher priority)
    const sortedPolicies = [...this.config.policies].sort((a, b) => a.priority - b.priority)

    for (const policy of sortedPolicies) {
      if (this.policyMatches(policy, context)) {
        return policy
      }
    }

    return null
  }

  private policyMatches(policy: ShieldPolicy, context: Record<string, any>): boolean {
    const conditions = policy.conditions

    // Check each condition
    for (const [key, condition] of Object.entries(conditions)) {
      if (!this.conditionMatches(key, condition, context)) {
        return false
      }
    }

    return true
  }

  private conditionMatches(key: string, condition: any, context: Record<string, any>): boolean {
    const value = context[key]

    if (typeof condition === 'boolean') {
      return value === condition
    }

    if (typeof condition === 'object') {
      if (condition.min !== undefined && value < condition.min) {
        return false
      }
      if (condition.max !== undefined && value > condition.max) {
        return false
      }
      if (condition.length) {
        if (condition.length.min !== undefined && (!Array.isArray(value) || value.length < condition.length.min)) {
          return false
        }
        if (condition.length.max !== undefined && (!Array.isArray(value) || value.length > condition.length.max)) {
          return false
        }
      }
    }

    return true
  }

  private async executeAction(
    correlationId: string,
    agentId: string,
    spanId: string,
    output: any,
    policy: ShieldPolicy,
    context: Record<string, any>,
    startTime: number
  ): Promise<ShieldDecision> {
    const action = policy.action

    switch (action.type) {
      case 'allow':
        return this.createAllowDecision(correlationId, agentId, spanId, output, policy.params?.reason || 'Policy allowed')

      case 'mask':
        return this.createMaskDecision(correlationId, agentId, spanId, output, policy, context, startTime)

      case 'rewrite':
        return this.createRewriteDecision(correlationId, agentId, spanId, output, policy, context, startTime)

      case 'require_approval':
        return this.createApprovalDecision(correlationId, agentId, spanId, output, policy, context, startTime)

      case 'block':
        return this.createBlockDecision(correlationId, agentId, spanId, output, policy, context, startTime)

      case 'flag':
        return this.createFlagDecision(correlationId, agentId, spanId, output, policy, context, startTime)

      default:
        return this.createAllowDecision(correlationId, agentId, spanId, output, 'Unknown action - defaulting to allow')
    }
  }

  private createAllowDecision(
    correlationId: string,
    agentId: string,
    spanId: string,
    output: any,
    reason: string
  ): ShieldDecision {
    return this.createDecision(
      correlationId,
      agentId,
      spanId,
      output,
      'pass',
      'default_allow',
      0
    )
  }

  private createMaskDecision(
    correlationId: string,
    agentId: string,
    spanId: string,
    output: any,
    policy: ShieldPolicy,
    context: Record<string, any>,
    startTime: number
  ): ShieldDecision {
    const sanitizedOutput = this.maskSensitiveData(output, policy.params?.patterns || [])
    
    return this.createDecision(
      correlationId,
      agentId,
      spanId,
      output,
      'mask',
      policy.id,
      Date.now() - startTime,
      sanitizedOutput
    )
  }

  private async createRewriteDecision(
    correlationId: string,
    agentId: string,
    spanId: string,
    output: any,
    policy: ShieldPolicy,
    context: Record<string, any>,
    startTime: number
  ): Promise<ShieldDecision> {
    const rewriteStartTime = Date.now()
    let rewriteAttempts = 0
    let rewrittenOutput = output

    try {
      // Attempt rewrite
      rewrittenOutput = this.attemptRewrite(output, policy.params)
      rewriteAttempts = 1

      // Re-judge the rewritten output
      const newVerdict = await this.judge.judgeOutput(
        context.correlationId || 'unknown',
        context.agentId || 'unknown', 
        context.spanId || 'unknown',
        typeof rewrittenOutput === 'string' ? rewrittenOutput : JSON.stringify(rewrittenOutput),
        []
      )
      
      // If rewrite improved scores, allow it
      if (newVerdict.verdict.groundedness > context.groundedness || newVerdict.verdict.citationCoverage > context.citation_coverage) {
        return this.createDecision(
          correlationId,
          agentId,
          spanId,
          output,
          'rewrite',
          policy.id,
          Date.now() - startTime,
          rewrittenOutput,
          { rewriteAttempts, rewriteTimeMs: Date.now() - rewriteStartTime }
        )
      } else {
        // Rewrite didn't help, require approval
        return this.createApprovalDecision(correlationId, agentId, spanId, output, policy, context, startTime)
      }
    } catch (error) {
      console.error('❌ Rewrite failed:', error)
      return this.createApprovalDecision(correlationId, agentId, spanId, output, policy, context, startTime)
    }
  }

  private createApprovalDecision(
    correlationId: string,
    agentId: string,
    spanId: string,
    output: any,
    policy: ShieldPolicy,
    context: Record<string, any>,
    startTime: number
  ): ShieldDecision {
    const approvalId = crypto.randomUUID()
    
    return this.createDecision(
      correlationId,
      agentId,
      spanId,
      output,
      'block',
      policy.id,
      Date.now() - startTime
    )
  }

  private createBlockDecision(
    correlationId: string,
    agentId: string,
    spanId: string,
    output: any,
    policy: ShieldPolicy,
    context: Record<string, any>,
    startTime: number
  ): ShieldDecision {
    return this.createDecision(
      correlationId,
      agentId,
      spanId,
      output,
      'block',
      policy.id,
      Date.now() - startTime
    )
  }

  private createFlagDecision(
    correlationId: string,
    agentId: string,
    spanId: string,
    output: any,
    policy: ShieldPolicy,
    context: Record<string, any>,
    startTime: number
  ): ShieldDecision {
    return this.createDecision(
      correlationId,
      agentId,
      spanId,
      output,
      'pass',
      policy.id,
      Date.now() - startTime
    )
  }

  private createDecision(
    correlationId: string,
    agentId: string,
    spanId: string,
    output: any,
    action: 'block' | 'mask' | 'rewrite' | 'pass',
    policyId: string,
    decisionTimeMs: number,
    sanitizedOutput?: any,
    performance?: any
  ): ShieldDecision {
    return {
      id: crypto.randomUUID(),
      correlationId,
      agentId,
      spanId,
      policyId,
      action,
      reason: 'Policy enforcement',
      originalOutput: output,
      sanitizedOutput,
      metadata: { performance, ...performance },
      timestamp: Date.now(),
      latencyMs: decisionTimeMs
    }
  }

  private maskSensitiveData(output: any, patterns: string[]): any {
    if (typeof output === 'string') {
      let maskedOutput = output
      
      for (const pattern of patterns) {
        const regex = new RegExp(this.config.privacy.maskPatterns[pattern] || pattern, 'gi')
        maskedOutput = maskedOutput.replace(regex, this.config.privacy.redactionToken.replace('{type}', pattern))
      }
      
      return maskedOutput
    }
    
    return output
  }

  private attemptRewrite(output: any, params: any): any {
    // Simple rewrite implementation - in production this would use an LLM
    if (typeof output === 'string') {
      const instruction = params.instruction || 'Improve factual accuracy and add citations'
      return `${output}\n\n[Note: ${instruction}]`
    }
    
    return output
  }

  private storeDecision(decision: ShieldDecision): void {
    if (this.config.audit.storeDecisions) {
      sentinelTelemetry.storeShieldDecision(decision)
    }
  }

  private emitAuditEvent(decision: ShieldDecision): void {
    const auditEvent: AuditEvent = {
      id: crypto.randomUUID(),
      correlationId: decision.correlationId,
      agentId: decision.agentId,
      spanId: decision.spanId,
      timestamp: decision.timestamp,
      type: 'shield_decision',
      policyId: decision.policyId,
      action: decision.action,
      reason: decision.reason,
      originalOutput: this.config.audit.storeDiffs ? decision.originalOutput : undefined,
      sanitizedOutput: this.config.audit.storeDiffs ? decision.sanitizedOutput : undefined,
      metadata: decision.metadata,
      latencyMs: decision.latencyMs
    }

    sentinelTelemetry.storeAuditEvent(auditEvent)

    // Emit GuardEvent
    sentinelTelemetry.createEvent(
      decision.correlationId,
      decision.agentId,
      decision.spanId,
      'judge_error',
      this.getSeverityForAction(decision.action),
      {
        rule_id: decision.policyId,
        action: decision.action,
        reason: decision.reason,
        decision_time_ms: decision.latencyMs,
        rewrite_attempts: decision.metadata.rewriteAttempts || 0,
        rewrite_time_ms: decision.metadata.rewriteTimeMs || 0
      },
      'flag'
    )
  }

  private getSeverityForAction(action: string): 'low' | 'medium' | 'high' | 'critical' | 'error' | 'warn' {
    switch (action) {
      case 'block':
        return 'critical'
      case 'require_approval':
        return 'high'
      case 'mask':
      case 'rewrite':
        return 'medium'
      case 'flag':
      case 'allow':
      default:
        return 'low'
    }
  }

  public getConfig(): ShieldConfig {
    return this.config
  }

  public isEnabled(): boolean {
    return this.config.enabled
  }

  public getMode(): string {
    return this.config.mode
  }

  public cleanup(): void {
    if (this.configReloadTimer) {
      clearInterval(this.configReloadTimer)
    }
  }
}
