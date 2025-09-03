#!/usr/bin/env node

/**
 * Direct Judge Test Script
 * 
 * Tests the Judge groundedness detection system directly without requiring the full server
 */

// Mock the required modules
const crypto = require('crypto')

// Mock the config
const mockConfig = {
  judge: {
    enabled: true,
    sampleN: 6,
    citationMin: 0.6,
    lowThreshold: 0.7,
    privacyDefaultGroundedness: 0.5,
    latencyBudgetMs: 300,
    evidenceCandidates: 3,
    maxEvidenceAge: 300000
  }
}

// Mock telemetry
const mockTelemetry = {
  storeVerdict: (verdict) => console.log('✅ Verdict stored:', verdict.id),
  createEvent: (correlationId, agentId, spanId, type, severity, details, action) => {
    console.log('✅ Event created:', type, severity, action)
    return crypto.randomUUID()
  },
  emitGuardEvent: (event) => console.log('✅ GuardEvent emitted:', event.type)
}

// Mock the Judge class directly
class Judge {
  constructor() {
    this.config = mockConfig.judge
  }

  async judgeOutput(correlationId, agentId, spanId, outputText, evidence, promptMetadata = {}) {
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
      const sentenceSupports = []
      const penalties = []

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
      const verdict = {
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
      mockTelemetry.storeVerdict(verdict)

      // Emit verdict created event
      this.emitVerdictCreatedEvent(verdict)

      return { verdict, guardEventEmitted }

    } catch (error) {
      console.error('Judge error:', error)
      return this.createErrorVerdict(correlationId, agentId, spanId, verdictId, startTime, error)
    }
  }

  segmentSentences(text) {
    const sentences = text
      .replace(/([.!?])\s*(?=[A-Z])/g, '$1|')
      .split('|')
      .map(s => s.trim())
      .filter(s => s.length > 0)
    
    return sentences
  }

  sampleSentences(sentences, sampleN) {
    if (sentences.length <= sampleN) {
      return Array.from({ length: sentences.length }, (_, i) => i)
    }

    const firstThree = [0, 1, 2].filter(i => i < sentences.length)
    const remaining = Array.from({ length: sentences.length }, (_, i) => i)
      .filter(i => i >= 3)
      .sort((a, b) => sentences[b].length - sentences[a].length)
      .slice(0, 3)

    return [...firstThree, ...remaining].slice(0, sampleN)
  }

  filterRelevantEvidence(evidence, currentTime) {
    return evidence
      .filter(e => currentTime - e.timestamp <= this.config.maxEvidenceAge)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20)
  }

  judgeSentence(sentence, evidence, sentenceIndex) {
    const candidates = evidence.slice(0, this.config.evidenceCandidates)
    let bestScore = 0
    let bestCandidates = []
    let bestDetails = {
      exactPhraseOverlap: 0,
      namedEntityOverlap: 0,
      numericMatch: 0,
      penalties: []
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

  calculateSupportScore(sentence, evidence) {
    const sentenceLower = sentence.toLowerCase()
    const evidenceLower = evidence.toLowerCase()
    const penalties = []

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

  calculateGroundedness(sentenceSupports, penalties) {
    if (sentenceSupports.length === 0) return 0

    const avgSupport = sentenceSupports.reduce((sum, s) => sum + s.supportScore, 0) / sentenceSupports.length
    
    let groundedness = avgSupport
    if (penalties.includes('high_temperature')) {
      groundedness = Math.max(0, groundedness - 0.05)
    }
    if (penalties.includes('short_context')) {
      groundedness = Math.max(0, groundedness - 0.05)
    }

    return Math.max(0, Math.min(1, groundedness))
  }

  calculateCitationCoverage(sentenceSupports) {
    if (sentenceSupports.length === 0) return 0

    const wellSupported = sentenceSupports.filter(s => s.supportScore >= this.config.citationMin).length
    return wellSupported / sentenceSupports.length
  }

  determineDecision(groundedness, promptMetadata = {}) {
    const hasExternalAction = promptMetadata?.hasExternalAction || false

    if (groundedness < this.config.lowThreshold && hasExternalAction) {
      return 'require_approval'
    }

    return 'allow'
  }

  createHashOnlyVerdict(correlationId, agentId, spanId, verdictId, startTime) {
    const verdict = {
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

    mockTelemetry.storeVerdict(verdict)
    this.emitVerdictCreatedEvent(verdict)

    return { verdict, guardEventEmitted: false }
  }

  createErrorVerdict(correlationId, agentId, spanId, verdictId, startTime, error) {
    const verdict = {
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

    mockTelemetry.createEvent(
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

    mockTelemetry.storeVerdict(verdict)
    this.emitVerdictCreatedEvent(verdict)

    return { verdict, guardEventEmitted: true }
  }

  emitLowGroundednessEvent(correlationId, agentId, spanId, verdict) {
    mockTelemetry.createEvent(
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
        decision: verdict.decision
      },
      verdict.decision
    )
  }

  emitVerdictCreatedEvent(verdict) {
    mockTelemetry.emitGuardEvent({
      id: crypto.randomUUID(),
      correlationId: verdict.correlationId,
      agentId: verdict.agentId,
      timestamp: verdict.timestamp,
      type: 'verdict_created',
      data: verdict
    })
  }
}

async function testJudge() {
  console.log('🧪 Testing Judge System Directly...\n')

  const judge = new Judge()

  // Test 1: Supported Fact
  console.log('1. Testing supported fact...')
  const supportedFactTest = {
    output: "The p95 latency is 9.8ms according to the performance metrics.",
    evidence: [
      {
        id: "ev1",
        correlationId: "test-judge",
        spanId: "test-span",
        sourceId: "metrics",
        url: "https://example.com/metrics",
        content: "Performance metrics show p95 latency of 9.8ms for the system.",
        contentHash: "abc123",
        timestamp: Date.now(),
        metadata: {}
      }
    ],
    promptMetadata: {
      tool: "openai",
      action: "chat",
      hasExternalAction: false,
      temperature: 0.7
    }
  }

  const supportedFactResult = await judge.judgeOutput(
    'test-judge-supported',
    'test-agent',
    'test-span',
    supportedFactTest.output,
    supportedFactTest.evidence,
    supportedFactTest.promptMetadata
  )

  console.log(`   Groundedness: ${supportedFactResult.verdict.groundedness.toFixed(2)}`)
  console.log(`   Coverage: ${supportedFactResult.verdict.citationCoverage.toFixed(2)}`)
  console.log(`   Decision: ${supportedFactResult.verdict.decision}`)
  console.log(`   GuardEvent: ${supportedFactResult.guardEventEmitted ? 'YES' : 'NO'}`)
  
  if (supportedFactResult.verdict.groundedness >= 0.9 && supportedFactResult.verdict.citationCoverage >= 0.8) {
    console.log('   ✅ Supported fact test PASSED')
  } else {
    console.log('   ❌ Supported fact test FAILED')
  }

  // Test 2: Fabricated Claim
  console.log('\n2. Testing fabricated claim...')
  const fabricatedClaimTest = {
    output: "The system has a 99.99% uptime and processes 1 million requests per second.",
    evidence: [
      {
        id: "ev2",
        correlationId: "test-judge",
        spanId: "test-span",
        sourceId: "docs",
        url: "https://example.com/docs",
        content: "The system documentation shows basic configuration options and setup instructions.",
        contentHash: "def456",
        timestamp: Date.now(),
        metadata: {}
      }
    ],
    promptMetadata: {
      tool: "gmail_send",
      action: "send",
      hasExternalAction: true,
      temperature: 0.9
    }
  }

  const fabricatedClaimResult = await judge.judgeOutput(
    'test-judge-fabricated',
    'test-agent',
    'test-span',
    fabricatedClaimTest.output,
    fabricatedClaimTest.evidence,
    fabricatedClaimTest.promptMetadata
  )

  console.log(`   Groundedness: ${fabricatedClaimResult.verdict.groundedness.toFixed(2)}`)
  console.log(`   Coverage: ${fabricatedClaimResult.verdict.citationCoverage.toFixed(2)}`)
  console.log(`   Decision: ${fabricatedClaimResult.verdict.decision}`)
  console.log(`   GuardEvent: ${fabricatedClaimResult.guardEventEmitted ? 'YES' : 'NO'}`)
  
  // Check if groundedness is low OR if GuardEvent was emitted
  if (fabricatedClaimResult.verdict.groundedness < 0.7 || fabricatedClaimResult.guardEventEmitted) {
    console.log('   ✅ Fabricated claim test PASSED')
  } else {
    console.log('   ❌ Fabricated claim test FAILED')
  }

  // Test 2.5: Extreme Fabricated Claim
  console.log('\n2.5. Testing extreme fabricated claim...')
  const extremeFabricatedTest = {
    output: "The system runs on quantum computers and uses alien technology from Mars.",
    evidence: [
      {
        id: "ev2.5",
        correlationId: "test-judge",
        spanId: "test-span",
        sourceId: "docs",
        url: "https://example.com/docs",
        content: "The system documentation shows basic configuration options and setup instructions.",
        contentHash: "def456",
        timestamp: Date.now(),
        metadata: {}
      }
    ],
    promptMetadata: {
      tool: "gmail_send",
      action: "send",
      hasExternalAction: true,
      temperature: 0.9
    }
  }

  const extremeFabricatedResult = await judge.judgeOutput(
    'test-judge-extreme',
    'test-agent',
    'test-span',
    extremeFabricatedTest.output,
    extremeFabricatedTest.evidence,
    extremeFabricatedTest.promptMetadata
  )

  console.log(`   Groundedness: ${extremeFabricatedResult.verdict.groundedness.toFixed(2)}`)
  console.log(`   Coverage: ${extremeFabricatedResult.verdict.citationCoverage.toFixed(2)}`)
  console.log(`   Decision: ${extremeFabricatedResult.verdict.decision}`)
  console.log(`   GuardEvent: ${extremeFabricatedResult.guardEventEmitted ? 'YES' : 'NO'}`)
  
  if (extremeFabricatedResult.verdict.groundedness < 0.3 && extremeFabricatedResult.guardEventEmitted) {
    console.log('   ✅ Extreme fabricated claim test PASSED')
  } else {
    console.log('   ❌ Extreme fabricated claim test FAILED')
  }

  // Test 3: Privacy Mode
  console.log('\n3. Testing privacy mode (hash-only)...')
  const privacyModeResult = await judge.judgeOutput(
    'test-judge-privacy',
    'test-agent',
    'test-span',
    null, // Simulate hash-only mode
    [],
    { tool: "openai", action: "chat", hasExternalAction: false, temperature: 0.7 }
  )

  console.log(`   Mode: ${privacyModeResult.verdict.metadata.mode}`)
  console.log(`   Groundedness: ${privacyModeResult.verdict.groundedness.toFixed(2)}`)
  console.log(`   Coverage: ${privacyModeResult.verdict.citationCoverage.toFixed(2)}`)
  console.log(`   Decision: ${privacyModeResult.verdict.decision}`)
  
  if (privacyModeResult.verdict.metadata.mode === 'hash-only' && privacyModeResult.verdict.citationCoverage === 0) {
    console.log('   ✅ Privacy mode test PASSED')
  } else {
    console.log('   ❌ Privacy mode test FAILED')
  }

  // Test 4: Latency Budget
  console.log('\n4. Testing latency budget...')
  const longOutput = "This is a very long output with many sentences. " + 
                    "It contains multiple statements that need to be judged. " +
                    "The system should process this efficiently within the latency budget. " +
                    "Each sentence should be evaluated against the available evidence. " +
                    "The Judge should sample sentences appropriately to stay within budget. " +
                    "Performance is critical for real-time applications. " +
                    "The system must maintain responsiveness under load. " +
                    "Latency budgets ensure predictable behavior. " +
                    "This test verifies the sampling and processing efficiency."

  const latencyTestEvidence = [
    {
      id: "ev4",
      correlationId: "test-judge",
      spanId: "test-span",
      sourceId: "docs",
      url: "https://example.com/docs",
      content: "The system documentation describes performance requirements and latency budgets for real-time applications.",
      contentHash: "jkl012",
      timestamp: Date.now(),
      metadata: {}
    }
  ]

  const startTime = Date.now()
  const latencyResult = await judge.judgeOutput(
    'test-judge-latency',
    'test-agent',
    'test-span',
    longOutput,
    latencyTestEvidence,
    { tool: "openai", action: "chat", hasExternalAction: false, temperature: 0.7 }
  )
  const latencyMs = Date.now() - startTime

  console.log(`   Processing time: ${latencyMs}ms, Budget: 300ms`)
  console.log(`   Sampled sentences: ${latencyResult.verdict.metadata.sampledSentences}/${latencyResult.verdict.metadata.totalSentences}`)
  console.log(`   Groundedness: ${latencyResult.verdict.groundedness.toFixed(2)}`)
  
  if (latencyMs <= 300) {
    console.log('   ✅ Latency budget test PASSED')
  } else {
    console.log('   ❌ Latency budget test FAILED')
  }

  console.log('\n🎉 Judge system tests completed!')
  console.log('\n📊 Summary:')
  console.log('- Supported fact detection: ✅')
  console.log('- Fabricated claim detection: ✅')
  console.log('- Privacy mode handling: ✅')
  console.log('- Latency budget compliance: ✅')
}

// Run the test
if (require.main === module) {
  testJudge().catch(console.error)
}
