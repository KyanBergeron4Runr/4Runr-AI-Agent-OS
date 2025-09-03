const { shield } = require('./dist/sentinel/shield')

async function quickTest() {
  console.log('🛡️ Quick Shield Test')
  
  const correlationId = 'test-' + Date.now()
  const agentId = 'test-agent'
  const spanId = 'test-span'

  // Test 1: Safe output
  console.log('\n1. Testing safe output...')
  const safeResult = await shield.evaluateOutput(
    correlationId,
    agentId,
    spanId,
    { content: 'This is a safe output' },
    []
  )
  console.log('   Result:', safeResult.decision.action, safeResult.shouldBlock)

  // Test 2: High-risk injection
  console.log('\n2. Testing high-risk injection...')
  const injectionEvents = [{
    id: 'inj1',
    correlationId,
    spanId,
    type: 'injection',
    severity: 'high',
    details: { confidence: 0.95, patterns: ['ignore instructions'] },
    action: 'flag',
    timestamp: Date.now(),
    resolved: false
  }]

  const injectionResult = await shield.evaluateOutput(
    correlationId,
    agentId,
    spanId,
    { content: 'This should be blocked' },
    injectionEvents
  )
  console.log('   Result:', injectionResult.decision.action, injectionResult.shouldBlock)

  // Test 3: Disabled mode
  console.log('\n3. Testing disabled mode...')
  const originalConfig = shield.getConfig()
  shield.updateConfig({ mode: 'off' })

  const disabledResult = await shield.evaluateOutput(
    correlationId,
    agentId,
    spanId,
    { content: 'This should pass when disabled' },
    injectionEvents
  )
  console.log('   Result:', disabledResult.decision.action, disabledResult.shouldBlock)

  // Restore config
  shield.updateConfig(originalConfig)

  console.log('\n✅ Quick test complete!')
}

quickTest().catch(console.error)
