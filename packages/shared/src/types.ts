// Core 4Runr types shared across packages

export interface Agent {
  id: string
  name: string
  description?: string
  status: 'active' | 'inactive' | 'error'
  createdAt: Date
  updatedAt: Date
  config: AgentConfig
}

export interface AgentConfig {
  systemPrompt?: string
  tools?: string[]
  model?: string
  temperature?: number
  maxTokens?: number
}

export interface Run {
  id: string
  agentId: string
  correlationId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  input: any
  output?: any
  error?: string
  startTime: Date
  endTime?: Date
  metadata?: Record<string, any>
}

// Sentinel types
export interface SentinelSpan {
  id: string
  correlationId: string
  agentId: string
  type: 'prompt' | 'retrieval' | 'output' | 'tool'
  startTime: number
  endTime?: number
  data: Record<string, any>
  metadata?: Record<string, any>
}

export interface SentinelEvent {
  id: string
  correlationId: string
  agentId: string
  type: string
  timestamp: number
  severity: 'info' | 'warn' | 'error'
  data: Record<string, any>
}

export interface GuardEvent extends SentinelEvent {
  type: 'sentinel.heartbeat' | 'sentinel.injection_detected' | 'sentinel.hallucination_detected' | 
        'shield.block' | 'shield.mask' | 'shield.rewrite' | 'shield.require_approval' |
        'judge.low_groundedness' | 'judge.low_citation_coverage' |
        'coach.report_generated' | 'coach.experiment_started' | 'coach.experiment_completed' | 'coach.rollback_applied'
}

export interface AuditEvent extends SentinelEvent {
  type: 'audit.shield_decision' | 'audit.policy_violation' | 'audit.config_change'
  action: 'block' | 'mask' | 'rewrite' | 'require_approval' | 'pass'
  reason: string
  policy?: string
}

// Health and readiness types
export interface HealthResponse {
  ok: boolean
  version: string
  time: string
  uptime: number
}

export interface ReadinessResponse {
  ready: boolean
  checks: {
    database: boolean
    redis: boolean
    sentinel: boolean
  }
  errors?: string[]
}

// Metrics types
export interface MetricsResponse {
  sentinel_spans_total: number
  sentinel_guard_events_total: number
  sentinel_audit_events_total: number
  shield_decisions_total: number
  judge_verdicts_total: number
  coach_experiments_total: number
  [key: string]: number
}

// SSE types
export interface SSEEvent {
  event: string
  data: string
  id?: string
  retry?: number
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  timestamp: number
}

// Configuration types
export interface SentinelConfig {
  mode: 'live' | 'mock'
  shieldMode: 'enforce' | 'monitor' | 'off'
  storePlain: boolean
  policies: Record<string, any>
}

export interface ShieldPolicy {
  id: string
  name: string
  description: string
  patterns: string[]
  action: 'block' | 'mask' | 'rewrite' | 'require_approval' | 'pass'
  severity: 'low' | 'medium' | 'high'
  enabled: boolean
}

// Coach types
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
