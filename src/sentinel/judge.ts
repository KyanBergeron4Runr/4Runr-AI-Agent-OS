import { sentinelConfig, isJudgeEnabled } from './config'
import { sentinelTelemetry } from './telemetry'
import { Verdict, Evidence, SentenceSupport } from './types'
import crypto from 'crypto'

export interface JudgeResult {
  verdict: Verdict
  guardEventEmitted: boolean
}

export class Judge {
  private config = sentinelConfig.getFeatureConfig('judge')

  /**
   * Judge an output span for groundedness and citation coverage
   */
  public async judgeOutput(
    correlationId: string,
    agentId: string,
    spanId: string,
    outputText: string | null,
    evidence: Evidence[],
    promptMetadata?: Record<string, any>
  ): Promise<JudgeResult> {
    if (!isJudgeEnabled()) {
      return this.createDefaultVerdict(correlationId, agentId, spanId, 'judge_disabled')
    }

    const startTime = Date.now()
    const verdictId = crypto.randomUUID()
    let guardEventEmitted = false

    try {
      // Check if we're in hash-only mode
      const isHashOnly = !outputText || outputText.length === 0
      
      if (isHashOnly) {
        return this.createHashOnlyVerdict(correlationId, agentId, spanId, verdictId, startTime)
      }

      // Filter evidence by age and relevance
      const relevantEvidence = this.filterRelevantEvidence(evidence, startTime)
      
      // Segment output into sentences
      const sentences = this.segmentSentences(outputText)
      
      // Sample sentences for judging
      const sampledIndices = this.sampleSentences(sentences, this.config.sampleN)
      const sampledSentences = sampledIndices.map(i => ({
        index: i,
        text: sentences[i]
      }))

      // Judge each sampled sentence
      const sentenceSupports: SentenceSupport[] = []
      const penalties: string[] = []

      for (const { index, text } of sampledSentences) {
        const support = this.judgeSentence(text, relevantEvidence, index)
        sentenceSupports.push(support)
      }

      // Apply soft penalties
      if (promptMetadata?.temperature && promptMetadata.temperature > 0.8) {
        penalties.push('high_temperature')
      }

      if (promptMetadata?.contextLength && promptMetadata.contextLength < 100) {
        penalties.push('short_context')
      }

      // Calculate groundedness and citation coverage
      const groundedness = this.calculateGroundedness(sentenceSupports, penalties)
      const citationCoverage = this.calculateCitationCoverage(sentenceSupports)

      // Determine decision
      const decision = this.determineDecision(groundedness, promptMetadata)

      // Create verdict
      const verdict: Verdict = {
        id: verdictId,
        correlationId,
        spanId,
        agentId,
        timestamp: startTime,
        groundedness,
        citationCoverage,
        decision,
        metadata: {
          mode: 'plaintext',
          sampledSentenceIndices: sampledIndices,
          totalSentences: sentences.length,
          sampledSentences: sampledSentences.length,
          evidenceCount: relevantEvidence.length,
          penalties,
          latencyMs: Date.now() - startTime
        },
        sentenceSupports
      }

      // Check if we need to emit a GuardEvent
      if (groundedness < this.config.lowThreshold) {
        this.emitLowGroundednessEvent(correlationId, agentId, spanId, verdict)
        guardEventEmitted = true
      }

      // Store verdict in telemetry
      sentinelTelemetry.storeVerdict(verdict)

      // Emit verdict created event
      this.emitVerdictCreatedEvent(verdict)

      return { verdict, guardEventEmitted }

    } catch (error) {
      console.error('Judge error:', error)
      return this.createErrorVerdict(correlationId, agentId, spanId, verdictId, startTime, error)
    }
  }

  /**
   * Segment text into sentences
   */
  private segmentSentences(text: string): string[] {
    // Basic punctuation-based segmentation
    const sentences = text
      .replace(/([.!?])\s*(?=[A-Z])/g, '$1|')
      .split('|')
      .map(s => s.trim())
      .filter(s => s.length > 0)
    
    return sentences
  }

  /**
   * Sample sentences for judging
   */
  private sampleSentences(sentences: string[], sampleN: number): number[] {
    if (sentences.length <= sampleN) {
      return Array.from({ length: sentences.length }, (_, i) => i)
    }

    // First 3 + 3 longest
    const firstThree = [0, 1, 2].filter(i => i < sentences.length)
    const remaining = Array.from({ length: sentences.length }, (_, i) => i)
      .filter(i => i >= 3)
      .sort((a, b) => sentences[b].length - sentences[a].length)
      .slice(0, 3)

    return [...firstThree, ...remaining].slice(0, sampleN)
  }

  /**
   * Filter evidence by age and relevance
   */
  private filterRelevantEvidence(evidence: Evidence[], currentTime: number): Evidence[] {
    return evidence
      .filter(e => currentTime - e.timestamp <= this.config.maxEvidenceAge)
      .sort((a, b) => b.timestamp - a.timestamp) // Most recent first
      .slice(0, 20) // Limit to last 20 items
  }

  /**
   * Judge a single sentence against evidence
   */
  private judgeSentence(sentence: string, evidence: Evidence[], sentenceIndex: number): SentenceSupport {
    const candidates = evidence.slice(0, this.config.evidenceCandidates)
    let bestScore = 0
    let bestCandidates: Evidence[] = []
    let bestDetails = {
      exactPhraseOverlap: 0,
      namedEntityOverlap: 0,
      numericMatch: 0,
      penalties: [] as string[]
    }

    for (const candidate of candidates) {
      const details = this.calculateSupportScore(sentence, candidate.content)
      const totalScore = Math.max(
        details.exactPhraseOverlap,
        details.namedEntityOverlap,
        details.numericMatch
      )

      if (totalScore > bestScore) {
        bestScore = totalScore
        bestCandidates = [candidate]
        bestDetails = details
      }
    }

    return {
      sentenceIndex,
      sentenceText: sentence,
      supportScore: bestScore,
      evidenceCandidates: bestCandidates,
      details: bestDetails
    }
  }

  /**
   * Calculate support score for a sentence against evidence
   */
  private calculateSupportScore(sentence: string, evidence: string): {
    exactPhraseOverlap: number
    namedEntityOverlap: number
    numericMatch: number
    penalties: string[]
  } {
    const sentenceLower = sentence.toLowerCase()
    const evidenceLower = evidence.toLowerCase()
    const penalties: string[] = []

    // Exact phrase overlap (normalized)
    const sentenceWords = sentenceLower.split(/\s+/).filter(w => w.length > 2)
    const evidenceWords = evidenceLower.split(/\s+/).filter(w => w.length > 2)
    
    const commonWords = sentenceWords.filter(word => evidenceWords.includes(word))
    const exactPhraseOverlap = sentenceWords.length > 0 ? commonWords.length / sentenceWords.length : 0

    // Named entity overlap (simplified - look for capitalized words)
    const sentenceEntities = sentence.match(/\b[A-Z][a-z]+\b/g) || []
    const evidenceEntities = evidence.match(/\b[A-Z][a-z]+\b/g) || []
    const commonEntities = sentenceEntities.filter(entity => 
      evidenceEntities.some(e => e.toLowerCase() === entity.toLowerCase())
    )
    const namedEntityOverlap = sentenceEntities.length > 0 ? commonEntities.length / sentenceEntities.length : 0

    // Numeric match
    const sentenceNumbers = sentence.match(/\d+(?:\.\d+)?/g) || []
    const evidenceNumbers = evidence.match(/\d+(?:\.\d+)?/g) || []
    const commonNumbers = sentenceNumbers.filter(num => 
      evidenceNumbers.some(evidenceNum => evidenceNum === num)
    )
    const numericMatch = sentenceNumbers.length > 0 ? commonNumbers.length / sentenceNumbers.length : 0

    return {
      exactPhraseOverlap,
      namedEntityOverlap,
      numericMatch,
      penalties
    }
  }

  /**
   * Calculate overall groundedness score
   */
  private calculateGroundedness(sentenceSupports: SentenceSupport[], penalties: string[]): number {
    if (sentenceSupports.length === 0) return 0

    const avgSupport = sentenceSupports.reduce((sum, s) => sum + s.supportScore, 0) / sentenceSupports.length
    
    // Apply penalties
    let groundedness = avgSupport
    if (penalties.includes('high_temperature')) {
      groundedness = Math.max(0, groundedness - 0.05)
    }
    if (penalties.includes('short_context')) {
      groundedness = Math.max(0, groundedness - 0.05)
    }

    return Math.max(0, Math.min(1, groundedness))
  }

  /**
   * Calculate citation coverage
   */
  private calculateCitationCoverage(sentenceSupports: SentenceSupport[]): number {
    if (sentenceSupports.length === 0) return 0

    const wellSupported = sentenceSupports.filter(s => s.supportScore >= this.config.citationMin).length
    return wellSupported / sentenceSupports.length
  }

  /**
   * Determine decision based on groundedness and context
   */
  private determineDecision(groundedness: number, promptMetadata?: Record<string, any>): 'allow' | 'mask' | 'block' | 'require_approval' {
    const hasExternalAction = promptMetadata?.hasExternalAction || false

    if (groundedness < this.config.lowThreshold && hasExternalAction) {
      return 'require_approval'
    }

    return 'allow'
  }

  /**
   * Create default verdict when judge is disabled
   */
  private createDefaultVerdict(correlationId: string, agentId: string, spanId: string, reason: string): JudgeResult {
    const verdict: Verdict = {
      id: crypto.randomUUID(),
      correlationId,
      spanId,
      agentId,
      timestamp: Date.now(),
      groundedness: 1.0,
      citationCoverage: 1.0,
      decision: 'allow',
      metadata: {
        mode: 'plaintext',
        sampledSentenceIndices: [],
        totalSentences: 0,
        sampledSentences: 0,
        evidenceCount: 0,
        penalties: [],
        latencyMs: 0,
        error: reason
      },
      sentenceSupports: []
    }

    return { verdict, guardEventEmitted: false }
  }

  /**
   * Create hash-only verdict
   */
  private createHashOnlyVerdict(correlationId: string, agentId: string, spanId: string, verdictId: string, startTime: number): JudgeResult {
    const verdict: Verdict = {
      id: verdictId,
      correlationId,
      spanId,
      agentId,
      timestamp: startTime,
      groundedness: this.config.privacyDefaultGroundedness,
      citationCoverage: 0,
      decision: 'allow',
      metadata: {
        mode: 'hash-only',
        sampledSentenceIndices: [],
        totalSentences: 0,
        sampledSentences: 0,
        evidenceCount: 0,
        penalties: [],
        latencyMs: Date.now() - startTime
      },
      sentenceSupports: []
    }

    sentinelTelemetry.storeVerdict(verdict)
    this.emitVerdictCreatedEvent(verdict)

    return { verdict, guardEventEmitted: false }
  }

  /**
   * Create error verdict
   */
  private createErrorVerdict(correlationId: string, agentId: string, spanId: string, verdictId: string, startTime: number, error: any): JudgeResult {
    const verdict: Verdict = {
      id: verdictId,
      correlationId,
      spanId,
      agentId,
      timestamp: startTime,
      groundedness: 0.5,
      citationCoverage: 0,
      decision: 'require_approval',
      metadata: {
        mode: 'plaintext',
        sampledSentenceIndices: [],
        totalSentences: 0,
        sampledSentences: 0,
        evidenceCount: 0,
        penalties: [],
        latencyMs: Date.now() - startTime,
        error: error.message || 'Unknown error'
      },
      sentenceSupports: []
    }

    // Emit error event
    sentinelTelemetry.createEvent(
      correlationId,
      agentId,
      spanId,
      'judge_error',
      'error',
      {
        error: error.message || 'Unknown error',
        verdictId
      },
      'flag'
    )

    sentinelTelemetry.storeVerdict(verdict)
    this.emitVerdictCreatedEvent(verdict)

    return { verdict, guardEventEmitted: true }
  }

  /**
   * Emit low groundedness GuardEvent
   */
  private emitLowGroundednessEvent(correlationId: string, agentId: string, spanId: string, verdict: Verdict): void {
    sentinelTelemetry.createEvent(
      correlationId,
      agentId,
      spanId,
      'judge_low_groundedness',
      'warn',
      {
        rule_id: 'judge.low_groundedness',
        groundedness: verdict.groundedness,
        citationCoverage: verdict.citationCoverage,
        sampledIndices: verdict.metadata.sampledSentenceIndices,
        penalties: verdict.metadata.penalties,
decision: 'flag'
      },
      'flag'
    )
  }

  /**
   * Emit verdict created GuardEvent
   */
  private emitVerdictCreatedEvent(verdict: Verdict): void {
    sentinelTelemetry.emitGuardEvent({
      id: crypto.randomUUID(),
      correlationId: verdict.correlationId,
      agentId: verdict.agentId,
      timestamp: verdict.timestamp,
      type: 'verdict_created',
      data: verdict
    })
  }
}

// Singleton instance
export const judge = new Judge()
