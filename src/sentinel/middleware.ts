import { sentinelTelemetry } from './telemetry'
import { sentinelConfig } from './config'
import { Judge } from './judge'
import { Shield } from './shield'
import { SentinelContext } from './types'
import crypto from 'crypto'

export class SentinelMiddleware {
  private static judge = new Judge()
  private static shield = Shield.getInstance()

  /**
   * Start monitoring a request
   */
  public static startMonitoring(
    correlationId: string,
    agentId: string,
    tool: string,
    action: string,
    params: any
  ): SentinelContext {
    if (!sentinelConfig.isFeatureEnabled('telemetry')) {
      return { correlationId, agentId, tool, action, params, startTime: Date.now() }
    }

    // Create root span for the request
    const spanId = sentinelTelemetry.startSpan(
      correlationId,
      agentId,
      tool,
      action,
      'tool_call',
      this.sanitizeParams(params)
    )

    // Store evidence for Judge
    sentinelTelemetry.storeEvidence({
      id: crypto.randomUUID(),
      correlationId,
      spanId,
      content: JSON.stringify(params),
      contentHash: crypto.createHash('sha256').update(JSON.stringify(params)).digest('hex'),
      timestamp: Date.now(),
      metadata: { type: 'request_params' }
    })

    return {
      correlationId,
      agentId,
      tool,
      action,
      params,
      spanId,
      startTime: Date.now()
    }
  }

  /**
   * End monitoring and perform safety checks
   */
  public static async endMonitoring(
    context: SentinelContext,
    result: any,
    error?: any
  ): Promise<{ shouldBlock: boolean; sanitizedOutput?: any; error?: string }> {
    if (!sentinelConfig.isFeatureEnabled('telemetry')) {
      return { shouldBlock: false }
    }

    try {
      // End the span
      sentinelTelemetry.endSpan(context.spanId!, {
        result: this.sanitizeResult(result),
        error: error ? error.message : undefined,
        success: !error
      })

      // Judge the output
      const judgeResult = await this.judgeOutput(context, result, error)
      
      // Apply Shield enforcement
      const shieldResult = await this.applyShieldEnforcement(context, result, judgeResult)

      return {
        shouldBlock: shieldResult.shouldBlock,
        sanitizedOutput: shieldResult.sanitizedOutput,
        error: shieldResult.error
      }

    } catch (error) {
      console.error('❌ Sentinel monitoring error:', error)
      
      // Default to blocking on error for safety
      return {
        shouldBlock: true,
        error: 'Sentinel monitoring failed - defaulting to block for safety'
      }
    }
  }

  /**
   * Judge the output using the Judge system
   */
  private static async judgeOutput(
    context: SentinelContext,
    result: any,
    error?: any
  ): Promise<any> {
    if (!sentinelConfig.isFeatureEnabled('judge')) {
      return { verdict: { groundedness: 1.0, citationCoverage: 1.0, decision: 'allow' } }
    }

    try {
      const outputText = this.extractOutputText(result)
      const judgeResult = await this.judge.judgeOutput(
        context.correlationId,
        context.agentId,
        context.spanId!,
        outputText,
        context.evidence || []
      )
      
      // Emit low groundedness event if needed
      if (judgeResult.verdict.groundedness < 0.7) {
        sentinelTelemetry.createEvent(
          context.correlationId,
          context.agentId,
          context.spanId!,
          'judge_low_groundedness',
          'warn',
          {
            rule_id: 'judge.low_groundedness',
            groundedness: judgeResult.verdict.groundedness,
            citationCoverage: judgeResult.verdict.citationCoverage,
            sampledIndices: judgeResult.verdict.metadata.sampledSentenceIndices,
            penalties: judgeResult.verdict.metadata.penalties,
            decision: 'flag'
          },
          'flag'
        )
      }

      return judgeResult.verdict
    } catch (error) {
      console.error('❌ Judge evaluation error:', error)
      return { groundedness: 0.5, citationCoverage: 0.5, decision: 'allow' }
    }
  }

  /**
   * Apply Shield enforcement
   */
  private static async applyShieldEnforcement(
    context: SentinelContext,
    result: any,
    verdict: any
  ): Promise<{ shouldBlock: boolean; sanitizedOutput?: any; error?: string }> {
    if (!sentinelConfig.isFeatureEnabled('shield') || !this.shield.isEnabled()) {
      return { shouldBlock: false }
    }

    try {
      // Gather events for Shield evaluation
      const events = sentinelTelemetry.getEventsForSpan(context.spanId!)
      
      // Determine if this is an external action
      const externalAction = this.isExternalAction(context.tool, context.action)
      
      // Evaluate with Shield
      const shieldDecision = await this.shield.evaluateOutput(
        context.correlationId,
        context.agentId,
        context.spanId!,
        result,
        verdict,
        events,
        {
          externalAction,
          sink: externalAction ? 'external' : 'internal',
          cost: 0, // TODO: Calculate actual cost
          latency: Date.now() - context.startTime
        }
      )

      // Handle Shield decision
      switch (shieldDecision.action) {
        case 'pass':
          return { shouldBlock: false }

        case 'mask':
          return { 
            shouldBlock: false, 
            sanitizedOutput: shieldDecision.sanitizedOutput 
          }

        case 'rewrite':
          return { 
            shouldBlock: false, 
            sanitizedOutput: shieldDecision.sanitizedOutput 
          }

        case 'block':
          return { 
            shouldBlock: true, 
            error: `Output blocked: ${shieldDecision.reason}` 
          }

        default:
          return { shouldBlock: false }
      }

    } catch (error) {
      console.error('❌ Shield enforcement error:', error)
      
      // Default to blocking on error for safety
      return {
        shouldBlock: true,
        error: 'Shield enforcement failed - defaulting to block for safety'
      }
    }
  }

  /**
   * Extract text from result for Judge evaluation
   */
  private static extractOutputText(result: any): string {
    if (typeof result === 'string') {
      return result
    }
    
    if (typeof result === 'object' && result !== null) {
      // Try common output fields
      if (result.text) return result.text
      if (result.content) return result.content
      if (result.message) return result.message
      if (result.data?.text) return result.data.text
      if (result.data?.content) return result.data.content
      
      // Fallback to JSON string
      return JSON.stringify(result)
    }
    
    return String(result)
  }

  /**
   * Check if this is an external action (email, webhook, file write, etc.)
   */
  private static isExternalAction(tool: string, action: string): boolean {
    const externalActions = [
      'gmail_send:send',
      'http_fetch:post',
      'http_fetch:put',
      'http_fetch:delete',
      'file:write',
      'webhook:trigger'
    ]
    
    return externalActions.includes(`${tool}:${action}`)
  }

  /**
   * Sanitize parameters for logging
   */
  private static sanitizeParams(params: any): any {
    if (!params) return params
    
    const sanitized = { ...params }
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'api_key']
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]'
      }
    }
    
    return sanitized
  }

  /**
   * Sanitize result for logging
   */
  private static sanitizeResult(result: any): any {
    if (!result) return result
    
    // For large results, just log metadata
    if (typeof result === 'string' && result.length > 1000) {
      return {
        type: 'string',
        length: result.length,
        preview: result.substring(0, 100) + '...'
      }
    }
    
    if (typeof result === 'object' && result !== null) {
      const sanitized = { ...result }
      
      // Remove sensitive fields from result
      const sensitiveFields = ['password', 'token', 'key', 'secret', 'api_key']
      for (const field of sensitiveFields) {
        if (sanitized[field]) {
          sanitized[field] = '[REDACTED]'
        }
      }
      
      return sanitized
    }
    
    return result
  }

  /**
   * Store evidence for Judge evaluation
   */
  private static storeEvidence(correlationId: string, agentId: string, spanId: string, params: any): void {
    if (!sentinelConfig.isFeatureEnabled('judge')) {
      return
    }

    try {
      // Extract evidence from parameters (e.g., URLs, documents, etc.)
      const evidence: any[] = []
      
      if (params.url) {
        evidence.push({
          type: 'url',
          content: params.url,
          source: 'input'
        })
      }
      
      if (params.document) {
        evidence.push({
          type: 'document',
          content: params.document,
          source: 'input'
        })
      }
      
      // Store evidence in telemetry
      if (evidence.length > 0) {
        for (const ev of evidence) {
          sentinelTelemetry.storeEvidence({
            id: crypto.randomUUID(),
            correlationId,
            spanId,
            sourceId: ev.sourceId,
            url: ev.url,
            content: ev.content,
            contentHash: crypto.createHash('sha256').update(ev.content).digest('hex'),
            timestamp: Date.now(),
            metadata: ev.metadata || {}
          })
        }
      }
    } catch (error) {
      console.error('❌ Error storing evidence:', error)
    }
  }
}
