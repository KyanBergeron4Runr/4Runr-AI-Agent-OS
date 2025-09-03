// Sentinel Types - Core telemetry and safety system types

export interface SentinelSpan {
  id: string
  correlationId: string
  agentId: string
  tool: string
  action: string
  type: 'prompt' | 'retrieval' | 'tool_call' | 'output' | 'error'
  startTime: number
  endTime?: number
  duration?: number
  input?: any
  output?: any
  metadata: Record<string, any>
  parentSpanId?: string
  children: string[] // span IDs
}

export interface SentinelEvent {
  id: string
  correlationId: string
  agentId: string
  spanId: string
  type: 'hallucination' | 'injection' | 'pii_detected' | 'cost_spike' | 'latency_spike' | 'error' | 'judge_low_groundedness' | 'judge_error'
  severity: 'low' | 'medium' | 'high' | 'critical' | 'error' | 'warn'
  timestamp: number
  details: Record<string, any>
  action: 'flag' | 'block' | 'mask' | 'require_approval'
  resolved: boolean
  resolvedAt?: number
  resolvedBy?: string
}

// Judge-specific types
export interface Evidence {
  id: string
  correlationId: string
  spanId: string
  sourceId?: string
  url?: string
  content: string
  contentHash: string
  timestamp: number
  metadata: Record<string, any>
}

export interface SentenceSupport {
  sentenceIndex: number
  sentenceText: string
  supportScore: number
  evidenceCandidates: Evidence[]
  details: {
    exactPhraseOverlap: number
    namedEntityOverlap: number
    numericMatch: number
    penalties: string[]
  }
}

export interface Verdict {
  id: string
  correlationId: string
  spanId: string
  agentId: string
  timestamp: number
  
  // Core scores
  groundedness: number // 0..1
  citationCoverage: number // 0..1
  
  // Decision
  decision: 'allow' | 'mask' | 'block' | 'require_approval'
  
  // Metadata
  metadata: {
    mode: 'plaintext' | 'hash-only'
    sampledSentenceIndices: number[]
    totalSentences: number
    sampledSentences: number
    evidenceCount: number
    penalties: string[]
    latencyMs: number
    error?: string
  }
  
  // Detailed analysis
  sentenceSupports: SentenceSupport[]
  
  // Optional PII notes
  piiFound?: string[]
}

// Shield-specific types
export interface ShieldPolicy {
  id: string
  name: string
  description: string
  conditions: ShieldConditions
  action: 'block' | 'mask' | 'rewrite' | 'pass'
  priority: number
  enabled: boolean
}

export interface ShieldConditions {
  eventType?: string
  severity?: string | { min?: string; max?: string }
  confidence?: { min?: number; max?: number }
  groundedness?: { min?: number; max?: number }
  hasExternalAction?: boolean
  patterns?: string[]
  cost?: { min?: number; max?: number }
  latency?: { min?: number; max?: number }
  [key: string]: any
}

export interface ShieldAction {
  description: string
  response?: {
    error: string
    code: string
    policyId: string | null
  }
  patterns?: {
    pii: string
    hallucination: string
    injection: string
  }
  maxAttempts?: number
  correctionPrompt?: string
}

export interface ShieldConfig {
  enabled: boolean
  mode: 'off' | 'monitor' | 'enforce'
  defaultAction: 'block' | 'mask' | 'rewrite' | 'pass'
  policies: ShieldPolicy[]
  actions: {
    block: ShieldAction
    mask: ShieldAction
    rewrite: ShieldAction
    pass: ShieldAction
  }
  audit: {
    enabled: boolean
    logOriginalOutput: boolean
    logSanitizedOutput: boolean
    retentionDays: number
  }
  performance: {
    maxLatencyMs: number
    timeoutMs: number
    cacheSize: number
  }
}

export interface ShieldDecision {
  id: string
  correlationId: string
  agentId: string
  spanId: string
  policyId: string
  action: 'block' | 'mask' | 'rewrite' | 'pass'
  reason: string
  originalOutput?: any
  sanitizedOutput?: any
  metadata: Record<string, any>
  timestamp: number
  latencyMs: number
}

export interface AuditEvent {
  id: string
  correlationId: string
  agentId: string
  spanId: string
  timestamp: number
  type: 'shield_decision'
  policyId: string
  action: 'block' | 'mask' | 'rewrite' | 'pass'
  reason: string
  originalOutput?: any
  sanitizedOutput?: any
  metadata: Record<string, any>
  latencyMs: number
}

export interface TelemetryData {
  spans: SentinelSpan[]
  events: SentinelEvent[]
  verdicts: Verdict[]
  evidence: Evidence[]
  shieldDecisions: ShieldDecision[]
  auditEvents: AuditEvent[]
  metrics: {
    totalSpans: number
    totalEvents: number
    totalVerdicts: number
    totalShieldDecisions: number
    totalAuditEvents: number
    avgLatency: number
    totalTokenUsage: number
    flaggedHallucinations: number
    flaggedInjections: number
    flaggedPII: number
    lowGroundednessCount: number
    judgeErrors: number
    blockedOutputs: number
    maskedOutputs: number
    rewrittenOutputs: number
  }
}

export interface SentinelConfig {
  telemetry: {
    enabled: boolean
    privacyMode: 'plaintext' | 'hash' | 'mask'
    retentionDays: number
  }
  hallucination: {
    enabled: boolean
    sensitivity: 'low' | 'medium' | 'high'
    patterns: string[]
  }
  injection: {
    enabled: boolean
    sensitivity: 'low' | 'medium' | 'high'
    patterns: string[]
    action: 'flag' | 'block' | 'mask'
  }
  pii: {
    enabled: boolean
    sensitivity: 'low' | 'medium' | 'high'
    patterns: string[]
    action: 'flag' | 'block' | 'mask'
  }
  cost: {
    enabled: boolean
    maxTokensPerRequest: number
    maxCostPerRequest: number
    action: 'flag' | 'block' | 'require_approval'
  }
  latency: {
    enabled: boolean
    maxLatencyMs: number
    action: 'flag' | 'block'
  }
  judge: {
    enabled: boolean
    sampleN: number // Number of sentences to sample
    citationMin: number // Minimum support score for citation coverage
    lowThreshold: number // Groundedness threshold for warnings
    privacyDefaultGroundedness: number // Default score in hash-only mode
    latencyBudgetMs: number // Maximum time allowed for judging
    evidenceCandidates: number // Number of evidence candidates per sentence
    maxEvidenceAge: number // Maximum age of evidence to consider (ms)
  }
  shield: ShieldConfig
}

export interface GuardEvent {
  id: string
  correlationId: string
  agentId: string
  timestamp: number
  type: 'span_start' | 'span_end' | 'event_created' | 'event_resolved' | 'verdict_created' | 'shield_decision'
  data: SentinelSpan | SentinelEvent | Verdict | ShieldDecision
}

// Performance tracking
export interface PerformanceMetrics {
  startTime: number
  endTime?: number
  duration?: number
  tokenUsage?: {
    input: number
    output: number
    total: number
  }
  cost?: {
    input: number
    output: number
    total: number
    currency: string
  }
}

export interface SentinelContext {
  correlationId: string
  agentId: string
  tool: string
  action: string
  params?: any
  spanId?: string
  startTime: number
  evidence?: Evidence[]
}
