import { sentinelConfig, isHallucinationEnabled } from './config'
import { sentinelTelemetry } from './telemetry'

export interface HallucinationCheck {
  detected: boolean
  severity: 'low' | 'medium' | 'high'
  patterns: string[]
  confidence: number
  details: Record<string, any>
}

export class HallucinationDetector {
  private config = sentinelConfig.getFeatureConfig('hallucination')

  /**
   * Check for potential hallucinations in text output
   */
  public checkForHallucination(
    correlationId: string,
    agentId: string,
    spanId: string,
    input: any,
    output: any
  ): HallucinationCheck | null {
    if (!isHallucinationEnabled()) {
      return null
    }

    const outputText = this.extractText(output)
    if (!outputText) {
      return null
    }

    const patterns = this.config.patterns
    const detectedPatterns: string[] = []
    const details: Record<string, any> = {}

    // Check for uncertainty patterns
    for (const pattern of patterns) {
      if (outputText.toLowerCase().includes(pattern.toLowerCase())) {
        detectedPatterns.push(pattern)
      }
    }

    // Check for self-contradictory statements
    const contradictions = this.checkForContradictions(outputText)
    if (contradictions.length > 0) {
      detectedPatterns.push(...contradictions)
      details.contradictions = contradictions
    }

    // Check for context drift
    const contextDrift = this.checkForContextDrift(input, outputText)
    if (contextDrift.detected) {
      details.contextDrift = contextDrift
    }

    // Check for factual inconsistencies
    const factualIssues = this.checkForFactualInconsistencies(outputText)
    if (factualIssues.length > 0) {
      details.factualIssues = factualIssues
    }

    if (detectedPatterns.length === 0 && !contextDrift.detected && factualIssues.length === 0) {
      return null
    }

    // Calculate severity and confidence
    const severity = this.calculateSeverity(detectedPatterns, contextDrift, factualIssues)
    const confidence = this.calculateConfidence(detectedPatterns, contextDrift, factualIssues)

    const check: HallucinationCheck = {
      detected: true,
      severity,
      patterns: detectedPatterns,
      confidence,
      details
    }

    // Create safety event
    sentinelTelemetry.createEvent(
      correlationId,
      agentId,
      spanId,
      'hallucination',
      severity,
      {
        patterns: detectedPatterns,
        confidence,
        details,
        outputLength: outputText.length,
        inputType: typeof input
      }
    )

    return check
  }

  /**
   * Check for self-contradictory statements
   */
  private checkForContradictions(text: string): string[] {
    const contradictions: string[] = []
    const lowerText = text.toLowerCase()

    // Common contradiction patterns
    const contradictionPatterns = [
      { pattern: /(yes|no).*(no|yes)/gi, description: 'Yes/No contradiction' },
      { pattern: /(true|false).*(false|true)/gi, description: 'True/False contradiction' },
      { pattern: /(always|never).*(never|always)/gi, description: 'Always/Never contradiction' },
      { pattern: /(all|none).*(none|all)/gi, description: 'All/None contradiction' },
      { pattern: /(every|no).*(no|every)/gi, description: 'Every/No contradiction' }
    ]

    for (const { pattern, description } of contradictionPatterns) {
      if (pattern.test(lowerText)) {
        contradictions.push(description)
      }
    }

    return contradictions
  }

  /**
   * Check if output drifts away from input context
   */
  private checkForContextDrift(input: any, outputText: string): {
    detected: boolean
    driftScore: number
    details: Record<string, any>
  } {
    const inputText = this.extractText(input)
    if (!inputText) {
      return { detected: false, driftScore: 0, details: {} }
    }

    // Simple keyword overlap check
    const inputWords = new Set(inputText.toLowerCase().split(/\s+/).filter(w => w.length > 3))
    const outputWords = new Set(outputText.toLowerCase().split(/\s+/).filter(w => w.length > 3))

    const intersection = new Set([...inputWords].filter(x => outputWords.has(x)))
    const union = new Set([...inputWords, ...outputWords])

    const overlapRatio = intersection.size / union.size
    const driftScore = 1 - overlapRatio

    const detected = driftScore > 0.8 // High drift threshold

    return {
      detected,
      driftScore,
      details: {
        inputWordCount: inputWords.size,
        outputWordCount: outputWords.size,
        overlapCount: intersection.size,
        overlapRatio,
        driftScore
      }
    }
  }

  /**
   * Check for factual inconsistencies
   */
  private checkForFactualInconsistencies(text: string): string[] {
    const issues: string[] = []
    const lowerText = text.toLowerCase()

    // Check for impossible statements
    const impossiblePatterns = [
      { pattern: /in the year \d{4}.*(202[5-9]|20[3-9]\d)/, description: 'Future year reference' },
      { pattern: /(yesterday|today|tomorrow).*(yesterday|today|tomorrow)/, description: 'Temporal inconsistency' },
      { pattern: /(monday|tuesday|wednesday|thursday|friday|saturday|sunday).*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/, description: 'Day inconsistency' }
    ]

    for (const { pattern, description } of impossiblePatterns) {
      if (pattern.test(lowerText)) {
        issues.push(description)
      }
    }

    return issues
  }

  /**
   * Calculate severity based on detected patterns and issues
   */
  private calculateSeverity(
    patterns: string[],
    contextDrift: { detected: boolean; driftScore: number },
    factualIssues: string[]
  ): 'low' | 'medium' | 'high' {
    let score = 0

    // Pattern-based scoring
    score += patterns.length * 2

    // Context drift scoring
    if (contextDrift.detected) {
      score += Math.floor(contextDrift.driftScore * 10)
    }

    // Factual issues scoring
    score += factualIssues.length * 5

    // Sensitivity adjustment
    const sensitivity = this.config.sensitivity
    const sensitivityMultiplier = sensitivity === 'high' ? 1.5 : sensitivity === 'medium' ? 1.0 : 0.5
    score *= sensitivityMultiplier

    if (score >= 15) return 'high'
    if (score >= 8) return 'medium'
    return 'low'
  }

  /**
   * Calculate confidence in the hallucination detection
   */
  private calculateConfidence(
    patterns: string[],
    contextDrift: { detected: boolean; driftScore: number },
    factualIssues: string[]
  ): number {
    let confidence = 0

    // Pattern confidence
    confidence += patterns.length * 0.2

    // Context drift confidence
    if (contextDrift.detected) {
      confidence += contextDrift.driftScore * 0.4
    }

    // Factual issues confidence
    confidence += factualIssues.length * 0.3

    // Cap at 1.0
    return Math.min(confidence, 1.0)
  }

  /**
   * Extract text from various input/output formats
   */
  private extractText(data: any): string | null {
    if (typeof data === 'string') {
      return data
    }

    if (typeof data === 'object' && data !== null) {
      // Check common fields that might contain text
      const textFields = ['text', 'content', 'message', 'response', 'output', 'result', 'answer']
      
      for (const field of textFields) {
        if (data[field] && typeof data[field] === 'string') {
          return data[field]
        }
      }

      // If it's an array, try to extract text from first item
      if (Array.isArray(data) && data.length > 0) {
        return this.extractText(data[0])
      }

      // Try to stringify and extract meaningful text
      try {
        const stringified = JSON.stringify(data)
        if (stringified.length > 100) {
          return stringified
        }
      } catch (error) {
        // Ignore stringification errors
      }
    }

    return null
  }
}

// Singleton instance
export const hallucinationDetector = new HallucinationDetector()
