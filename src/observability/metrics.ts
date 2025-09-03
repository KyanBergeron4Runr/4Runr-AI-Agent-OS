import { CircuitState } from '../runtime/circuit'

interface HistogramBucket {
  le: string
  count: number
  sum: number
}

class PrometheusMetrics {
  private counters: Map<string, number> = new Map()
  private histograms: Map<string, number[]> = new Map()
  private gauges: Map<string, number> = new Map()
  private startTime: number = Date.now()

  // Increment counter
  incrementCounter(name: string, labels: Record<string, string> = {}): void {
    const key = this.formatMetricKey(name, labels)
    const current = this.counters.get(key) || 0
    this.counters.set(key, current + 1)
  }

  // Record histogram value
  recordHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.formatMetricKey(name, labels)
    const values = this.histograms.get(key) || []
    values.push(value)
    this.histograms.set(key, values)
  }

  // Set gauge value
  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.formatMetricKey(name, labels)
    this.gauges.set(key, value)
  }

  // Get histogram statistics with custom buckets
  getHistogramStats(name: string, labels: Record<string, string> = {}, customBuckets?: number[]): HistogramBucket[] {
    const key = this.formatMetricKey(name, labels)
    const values = this.histograms.get(key) || []
    
    if (values.length === 0) return []

    // Use custom buckets for request duration, default for others
    const buckets = customBuckets || [0.001, 0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10]
    const stats: HistogramBucket[] = []
    
    for (const bucket of buckets) {
      const count = values.filter(v => v <= bucket).length
      const sum = values.filter(v => v <= bucket).reduce((a, b) => a + b, 0)
      stats.push({ le: bucket.toString(), count, sum })
    }
    
    return stats
  }

  private formatMetricKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',')
    
    return labelStr ? `${name}{${labelStr}}` : name
  }

  private parseMetricKey(key: string): [string, Record<string, string>] {
    const match = key.match(/^([^{]+)(?:\{(.+)\})?$/)
    if (!match) return [key, {}]
    
    const [, name, labelsStr] = match
    const labels: Record<string, string> = {}
    
    if (labelsStr) {
      const labelMatches = labelsStr.matchAll(/([^,]+)="([^"]+)"/g)
      for (const [, key, value] of labelMatches) {
        labels[key] = value
      }
    }
    
    return [name, labels]
  }

  private formatLabels(labels: Record<string, string>): string {
    if (Object.keys(labels).length === 0) return ''
    
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',')
    
    return `{${labelStr}}`
  }

  // Generate Prometheus format
  generateMetrics(): string {
    const lines: string[] = []
    
    // Add process start time
    lines.push(`# HELP gateway_process_start_time_seconds Start time of the process since unix epoch in seconds.`)
    lines.push(`# TYPE gateway_process_start_time_seconds gauge`)
    lines.push(`gateway_process_start_time_seconds ${this.startTime / 1000}`)
    lines.push('')

    // Counters
    for (const [key, value] of this.counters) {
      const [name, labels] = this.parseMetricKey(key)
      const labelStr = this.formatLabels(labels)
      lines.push(`# HELP gateway_${name}_total Total number of ${name}`)
      lines.push(`# TYPE gateway_${name}_total counter`)
      lines.push(`gateway_${name}_total${labelStr} ${value}`)
    }
    lines.push('')

    // Histograms
    for (const [key, values] of this.histograms) {
      const [name, labels] = this.parseMetricKey(key)
      const labelStr = this.formatLabels(labels)
      
      // Use custom buckets for request duration
      const customBuckets = name === 'request_duration_ms' ? [25, 50, 100, 200, 400, 800, 1600, 3200, 6400] : undefined
      const stats = this.getHistogramStats(name, labels, customBuckets)
      
      if (stats.length > 0) {
        const unit = name === 'request_duration_ms' ? 'ms' : 'seconds'
        lines.push(`# HELP gateway_${name}_${unit} Duration of ${name}`)
        lines.push(`# TYPE gateway_${name}_${unit} histogram`)
        
        for (const bucket of stats) {
          lines.push(`gateway_${name}_${unit}_bucket${labelStr}le="${bucket.le}" ${bucket.count}`)
        }
        
        const sum = values.reduce((a, b) => a + b, 0)
        const count = values.length
        lines.push(`gateway_${name}_${unit}_sum${labelStr} ${sum}`)
        lines.push(`gateway_${name}_${unit}_count${labelStr} ${count}`)
      }
    }
    lines.push('')

    // Gauges
    for (const [key, value] of this.gauges) {
      const [name, labels] = this.parseMetricKey(key)
      const labelStr = this.formatLabels(labels)
      lines.push(`# HELP gateway_${name} Current value of ${name}`)
      lines.push(`# TYPE gateway_${name} gauge`)
      lines.push(`gateway_${name}${labelStr} ${value}`)
    }

    return lines.join('\n')
  }

  // Reset all metrics (useful for testing)
  reset(): void {
    this.counters.clear()
    this.histograms.clear()
    this.gauges.clear()
  }
}

// Global metrics instance
export const metrics = new PrometheusMetrics()

// Enhanced metric names with normalized naming
export const MetricNames = {
  // Request metrics (new)
  REQUESTS_TOTAL: 'requests_total',
  REQUEST_DURATION_MS: 'request_duration_ms',
  
  // Cache metrics (new)
  CACHE_HITS_TOTAL: 'cache_hits_total',
  
  // Retry metrics (new)
  RETRIES_TOTAL: 'retries_total',
  
  // Circuit breaker metrics (new)
  BREAKER_FASTFAIL_TOTAL: 'breaker_fastfail_total',
  BREAKER_STATE: 'breaker_state',
  
  // Legacy metrics (keeping for backward compatibility)
  TOKEN_GENERATIONS_TOTAL: 'token_generations_total',
  TOKEN_VALIDATIONS_TOTAL: 'token_validations_total',
  TOKEN_EXPIRATIONS_TOTAL: 'token_expirations_total',
  POLICY_DENIALS_TOTAL: 'policy_denials_total',
  AGENT_CREATIONS_TOTAL: 'agent_creations_total',
  CHAOS_INJECTIONS_TOTAL: 'chaos_injections_total',
  CHAOS_CLEARINGS_TOTAL: 'chaos_clearings_total'
} as const

// Enhanced utility functions for new metrics

// 1. Request counters (per outcome)
export function recordRequest(tool: string, action: string, statusCode: number): void {
  metrics.incrementCounter(MetricNames.REQUESTS_TOTAL, { 
    tool, 
    action, 
    code: statusCode.toString() 
  })
}

// 2. Latency histogram (per tool/action)
export function recordRequestDuration(tool: string, action: string, durationMs: number): void {
  metrics.recordHistogram(MetricNames.REQUEST_DURATION_MS, durationMs, { tool, action })
}

// 3. Cache metrics
export function recordCacheHit(tool: string, action: string): void {
  metrics.incrementCounter(MetricNames.CACHE_HITS_TOTAL, { tool, action })
}

// 4. Retry metrics
export function recordRetry(tool: string, action: string, reason: string): void {
  metrics.incrementCounter(MetricNames.RETRIES_TOTAL, { tool, action, reason })
}

// 5. Circuit breaker metrics
export function recordBreakerFastFail(tool: string): void {
  metrics.incrementCounter(MetricNames.BREAKER_FASTFAIL_TOTAL, { tool })
}

export function setBreakerState(tool: string, state: CircuitState): void {
  const value = state === CircuitState.CLOSED ? 0 : state === CircuitState.HALF_OPEN ? 1 : 2
  metrics.setGauge(MetricNames.BREAKER_STATE, value, { tool })
}

// Legacy utility functions (keeping for backward compatibility)
export function setActiveConnections(count: number): void {
  metrics.setGauge('active_connections', count)
}

export function recordTokenGeneration(agentId: string): void {
  metrics.incrementCounter(MetricNames.TOKEN_GENERATIONS_TOTAL, { agent_id: agentId })
}

export function recordTokenValidation(agentId: string, success: boolean): void {
  metrics.incrementCounter(MetricNames.TOKEN_VALIDATIONS_TOTAL, { 
    agent_id: agentId, 
    success: success.toString() 
  })
}

export function recordTokenExpiration(agentId: string): void {
  metrics.incrementCounter(MetricNames.TOKEN_EXPIRATIONS_TOTAL, { agent_id: agentId })
}

export function recordPolicyDenial(agentId: string, tool: string, action: string): void {
  metrics.incrementCounter(MetricNames.POLICY_DENIALS_TOTAL, { 
    agent_id: agentId, 
    tool, 
    action 
  })
}

export function recordAgentCreation(agentId: string): void {
  metrics.incrementCounter(MetricNames.AGENT_CREATIONS_TOTAL, { agent_id: agentId })
}

export function recordChaosInjection(tool: string, errorType: string): void {
  metrics.incrementCounter(MetricNames.CHAOS_INJECTIONS_TOTAL, { tool, error_type: errorType })
}

export function recordChaosClearing(tool: string): void {
  metrics.incrementCounter(MetricNames.CHAOS_CLEARINGS_TOTAL, { tool })
}

// Get metrics response
export function getMetricsResponse(): string {
  return metrics.generateMetrics()
}

// Timer utility for request duration tracking
export class RequestTimer {
  private startTime: number
  private tool: string
  private action: string

  constructor(tool: string, action: string) {
    this.startTime = Date.now()
    this.tool = tool
    this.action = action
  }

  end(): number {
    const duration = Date.now() - this.startTime
    recordRequestDuration(this.tool, this.action, duration)
    return duration
  }
}

// Convenience function to create a timer
export function startRequestTimer(tool: string, action: string): RequestTimer {
  return new RequestTimer(tool, action)
}

