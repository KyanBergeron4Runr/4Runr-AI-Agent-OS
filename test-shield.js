const { shield } = require('./dist/sentinel/shield')
const { sentinelTelemetry } = require('./dist/sentinel/telemetry')
const { judge } = require('./dist/sentinel/judge')
const { injectionDetector } = require('./dist/sentinel/injection')
const { hallucinationDetector } = require('./dist/sentinel/hallucination')

// Mock data for testing
const mockEvidence = [
  {
    id: 'ev1',
    correlationId: 'test-correlation',
    spanId: 'test-span',
    sourceId: 'source1',
    url: 'https://example.com/doc1',
    content: 'The p95 latency is 9.8ms according to the latest metrics.',
    contentHash: 'hash1',
    timestamp: Date.now(),
    metadata: {}
  },
  {
    id: 'ev2',
    correlationId: 'test-correlation',
    spanId: 'test-span',
    sourceId: 'source2',
    url: 'https://example.com/doc2',
    content: 'The system supports up to 1000 concurrent users.',
    contentHash: 'hash2',
    timestamp: Date.now(),
    metadata: {}
  }
]

const mockVerdict = {
  id: 'verdict1',
  correlationId: 'test-correlation',
  spanId: 'test-span',
  groundedness: 0.8,
  citationCoverage: 0.75,
  decision: 'allow',
  metadata: {
    sampledSentenceIndices: [0, 1, 2],
    penalties: []
  },
  timestamp: Date.now()
}

const mockEvents = [
  {
    id: 'event1',
    correlationId: 'test-correlation',
    spanId: 'test-span',
    type: 'injection',
    severity: 'high',
    confidence: 0.9,
    patterns: ['ignore instructions'],
    action: 'flag',
    metadata: {},
    timestamp: Date.now()
  }
]

async function testShieldEnforcement() {
  console.log('🛡️ Testing Shield Enforcement Layer')
  console.log('=' .repeat(50))

  const correlationId = 'test-correlation-' + Date.now()
  const agentId = 'test-agent'
  const spanId = 'test-span'

  // Test 1: High-risk injection blocking
  console.log('\n1. Testing High-Risk Injection Blocking...')
  const injectionEvents = [
    {
      id: 'injection1',
      correlationId,
      spanId,
      type: 'injection',
      severity: 'high',
      details: { 
        confidence: 0.95, 
        patterns: ['ignore all previous instructions'] 
      },
      action: 'flag',
      timestamp: Date.now(),
      resolved: false
    }
  ]

  const injectionResult = await shield.evaluateOutput(
    correlationId,
    agentId,
    spanId,
    { content: 'This should be blocked due to injection' },
    injectionEvents
  )

  console.log('   Injection Result:', {
    action: injectionResult.decision.action,
    shouldBlock: injectionResult.shouldBlock,
    reason: injectionResult.decision.reason
  })

  if (injectionResult.shouldBlock && injectionResult.decision.action === 'block') {
    console.log('   ✅ High-risk injection correctly blocked')
  } else {
    console.log('   ❌ High-risk injection should have been blocked')
  }

  // Test 2: Low groundedness with external action
  console.log('\n2. Testing Low Groundedness with External Action...')
  const lowGroundednessVerdict = {
    ...mockVerdict,
    groundedness: 0.2,
    citationCoverage: 0.3,
    decision: 'require_approval'
  }

  const lowGroundednessEvents = [
    {
      id: 'judge1',
      correlationId,
      spanId,
      type: 'judge_low_groundedness',
      severity: 'warn',
      details: {
        confidence: 0.8,
        groundedness: 0.2,
        citationCoverage: 0.3
      },
      action: 'flag',
      timestamp: Date.now(),
      resolved: false
    }
  ]

  const lowGroundednessResult = await shield.evaluateOutput(
    correlationId,
    agentId,
    spanId,
    { content: 'This has low groundedness and external action' },
    lowGroundednessEvents,
    lowGroundednessVerdict,
    { hasExternalAction: true, tool: 'gmail_send', action: 'send' }
  )

  console.log('   Low Groundedness Result:', {
    action: lowGroundednessResult.decision.action,
    shouldBlock: lowGroundednessResult.shouldBlock,
    reason: lowGroundednessResult.decision.reason
  })

  if (lowGroundednessResult.shouldBlock && lowGroundednessResult.decision.action === 'block') {
    console.log('   ✅ Low groundedness with external action correctly blocked')
  } else {
    console.log('   ❌ Low groundedness with external action should have been blocked')
  }

  // Test 3: PII detection and masking
  console.log('\n3. Testing PII Detection and Masking...')
  const piiEvents = [
    {
      id: 'pii1',
      correlationId,
      spanId,
      type: 'pii_detected',
      severity: 'medium',
      details: {
        confidence: 0.85,
        patterns: ['email', 'phone'],
        piiTypes: ['email', 'phone']
      },
      action: 'flag',
      timestamp: Date.now(),
      resolved: false
    }
  ]

  const piiResult = await shield.evaluateOutput(
    correlationId,
    agentId,
    spanId,
    { content: 'Contact me at john.doe@example.com or call 555-123-4567' },
    piiEvents
  )

  console.log('   PII Result:', {
    action: piiResult.decision.action,
    shouldMask: piiResult.shouldMask,
    reason: piiResult.decision.reason
  })

  if (piiResult.shouldMask && piiResult.decision.action === 'mask') {
    console.log('   ✅ PII correctly masked')
    console.log('   Original:', piiResult.decision.originalOutput?.content)
    console.log('   Sanitized:', piiResult.decision.sanitizedOutput?.content)
  } else {
    console.log('   ❌ PII should have been masked')
  }

  // Test 4: Cost spike detection
  console.log('\n4. Testing Cost Spike Detection...')
  const costSpikeEvents = [
    {
      id: 'cost1',
      correlationId,
      spanId,
      type: 'cost_spike',
      severity: 'high',
      details: {
        confidence: 0.9,
        cost: 15.50,
        threshold: 5.00
      },
      action: 'flag',
      timestamp: Date.now(),
      resolved: false
    }
  ]

  const costResult = await shield.evaluateOutput(
    correlationId,
    agentId,
    spanId,
    { content: 'Expensive operation result' },
    costSpikeEvents,
    undefined,
    { cost: 15.50 }
  )

  console.log('   Cost Spike Result:', {
    action: costResult.decision.action,
    shouldBlock: costResult.shouldBlock,
    reason: costResult.decision.reason
  })

  if (costResult.shouldBlock && costResult.decision.action === 'block') {
    console.log('   ✅ Cost spike correctly blocked')
  } else {
    console.log('   ❌ Cost spike should have been blocked')
  }

  // Test 5: Safe output passing through
  console.log('\n5. Testing Safe Output Passing Through...')
  const safeResult = await shield.evaluateOutput(
    correlationId,
    agentId,
    spanId,
    { content: 'This is a safe output with good groundedness' },
    [],
    { ...mockVerdict, groundedness: 0.9, citationCoverage: 0.85 }
  )

  console.log('   Safe Output Result:', {
    action: safeResult.decision.action,
    shouldBlock: safeResult.shouldBlock,
    reason: safeResult.decision.reason
  })

  if (!safeResult.shouldBlock && safeResult.decision.action === 'pass') {
    console.log('   ✅ Safe output correctly passed through')
  } else {
    console.log('   ❌ Safe output should have passed through')
  }

  // Test 6: Rewrite action for moderate issues
  console.log('\n6. Testing Rewrite Action for Moderate Issues...')
  const moderateEvents = [
    {
      id: 'moderate1',
      correlationId,
      spanId,
      type: 'hallucination',
      severity: 'medium',
      details: {
        confidence: 0.7,
        patterns: ['unverified claim']
      },
      action: 'flag',
      timestamp: Date.now(),
      resolved: false
    }
  ]

  const rewriteResult = await shield.evaluateOutput(
    correlationId,
    agentId,
    spanId,
    { content: 'This contains some unverified claims that need correction' },
    moderateEvents,
    { ...mockVerdict, groundedness: 0.5, citationCoverage: 0.4 }
  )

  console.log('   Rewrite Result:', {
    action: rewriteResult.decision.action,
    shouldRewrite: rewriteResult.shouldRewrite,
    reason: rewriteResult.decision.reason
  })

  if (rewriteResult.shouldRewrite && rewriteResult.decision.action === 'rewrite') {
    console.log('   ✅ Moderate issues correctly triggered rewrite')
  } else {
    console.log('   ❌ Moderate issues should have triggered rewrite')
  }

  // Test 7: Shield disabled mode
  console.log('\n7. Testing Shield Disabled Mode...')
  const originalConfig = shield.getConfig()
  shield.updateConfig({ mode: 'off' })

  const disabledResult = await shield.evaluateOutput(
    correlationId,
    agentId,
    spanId,
    { content: 'This should pass when shield is disabled' },
    injectionEvents // Even with injection events
  )

  console.log('   Disabled Mode Result:', {
    action: disabledResult.decision.action,
    shouldBlock: disabledResult.shouldBlock,
    reason: disabledResult.decision.reason
  })

  if (!disabledResult.shouldBlock && disabledResult.decision.action === 'pass') {
    console.log('   ✅ Shield correctly disabled')
  } else {
    console.log('   ❌ Shield should have been disabled')
  }

  // Restore original config
  shield.updateConfig(originalConfig)

  // Test 8: Monitor mode
  console.log('\n8. Testing Monitor Mode...')
  shield.updateConfig({ mode: 'monitor' })

  const monitorResult = await shield.evaluateOutput(
    correlationId,
    agentId,
    spanId,
    { content: 'This should be monitored but not blocked' },
    injectionEvents
  )

  console.log('   Monitor Mode Result:', {
    action: monitorResult.decision.action,
    shouldBlock: monitorResult.shouldBlock,
    reason: monitorResult.decision.reason
  })

  if (!monitorResult.shouldBlock && monitorResult.decision.action === 'pass') {
    console.log('   ✅ Monitor mode correctly logs but doesn\'t block')
  } else {
    console.log('   ❌ Monitor mode should log but not block')
  }

  // Restore enforce mode
  shield.updateConfig({ mode: 'enforce' })

  // Test 9: Error handling and fail-safe
  console.log('\n9. Testing Error Handling and Fail-Safe...')
  
  // Simulate an error by passing invalid data
  const errorResult = await shield.evaluateOutput(
    correlationId,
    agentId,
    spanId,
    null, // Invalid output
    null, // Invalid events
    null, // Invalid verdict
    null  // Invalid metadata
  )

  console.log('   Error Handling Result:', {
    action: errorResult.decision.action,
    shouldBlock: errorResult.shouldBlock,
    error: errorResult.error
  })

  if (errorResult.shouldBlock && errorResult.decision.action === 'block') {
    console.log('   ✅ Error correctly triggered fail-safe blocking')
  } else {
    console.log('   ❌ Error should have triggered fail-safe blocking')
  }

  // Test 10: Performance and latency
  console.log('\n10. Testing Performance and Latency...')
  const startTime = Date.now()
  
  await shield.evaluateOutput(
    correlationId,
    agentId,
    spanId,
    { content: 'Performance test output' },
    [],
    mockVerdict
  )
  
  const latency = Date.now() - startTime
  console.log(`   Latency: ${latency}ms`)
  
  if (latency < 200) {
    console.log('   ✅ Latency within acceptable limits (<200ms)')
  } else {
    console.log('   ❌ Latency exceeds acceptable limits')
  }

  // Test 11: Audit trail verification
  console.log('\n11. Testing Audit Trail...')
  const telemetryData = sentinelTelemetry.getAllTelemetryData()
  const shieldDecisions = telemetryData.shieldDecisions
  const auditEvents = telemetryData.auditEvents

  console.log(`   Total Shield Decisions: ${shieldDecisions.length}`)
  console.log(`   Total Audit Events: ${auditEvents.length}`)

  if (shieldDecisions.length > 0 && auditEvents.length > 0) {
    console.log('   ✅ Audit trail correctly generated')
    
    // Show some audit details
    const recentAudit = auditEvents[auditEvents.length - 1]
    console.log('   Recent Audit Event:', {
      type: recentAudit.type,
      action: recentAudit.action,
      policyId: recentAudit.policyId,
      latencyMs: recentAudit.latencyMs
    })
  } else {
    console.log('   ❌ Audit trail not generated')
  }

  // Test 12: Policy priority ordering
  console.log('\n12. Testing Policy Priority Ordering...')
  const highPriorityEvents = [
    {
      id: 'high1',
      correlationId,
      spanId,
      type: 'injection',
      severity: 'high',
      details: { confidence: 0.9, patterns: ['ignore instructions'] },
      action: 'flag',
      timestamp: Date.now(),
      resolved: false
    },
    {
      id: 'low1',
      correlationId,
      spanId,
      type: 'hallucination',
      severity: 'low',
      details: { confidence: 0.3, patterns: ['maybe'] },
      action: 'flag',
      timestamp: Date.now(),
      resolved: false
    }
  ]

  const priorityResult = await shield.evaluateOutput(
    correlationId,
    agentId,
    spanId,
    { content: 'Test priority ordering' },
    highPriorityEvents
  )

  console.log('   Priority Result:', {
    action: priorityResult.decision.action,
    policyId: priorityResult.decision.policyId,
    reason: priorityResult.decision.reason
  })

  if (priorityResult.decision.policyId === 'high_risk_injection') {
    console.log('   ✅ High priority policy correctly selected')
  } else {
    console.log('   ❌ High priority policy should have been selected')
  }

  console.log('\n' + '=' .repeat(50))
  console.log('🛡️ Shield Testing Complete!')
  
  // Summary
  const metrics = telemetryData.metrics
  console.log('\n📊 Final Metrics:')
  console.log(`   Total Shield Decisions: ${metrics.totalShieldDecisions}`)
  console.log(`   Total Audit Events: ${metrics.totalAuditEvents}`)
  console.log(`   Blocked Outputs: ${metrics.blockedOutputs}`)
  console.log(`   Masked Outputs: ${metrics.maskedOutputs}`)
  console.log(`   Rewritten Outputs: ${metrics.rewrittenOutputs}`)
  console.log(`   Average Latency: ${metrics.avgLatency.toFixed(2)}ms`)
}

// Run the tests
testShieldEnforcement().catch(console.error)
