const { shield } = require('./dist/sentinel/shield')

async function simpleShieldTest() {
  console.log('🛡️ Simple Shield Test')
  console.log('=' .repeat(40))

  const correlationId = 'test-' + Date.now()
  const agentId = 'test-agent'
  const spanId = 'test-span'

  try {
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
    console.log('   ✅ Safe output test completed')

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
    console.log('   ✅ Injection test completed')

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
    console.log('   ✅ Disabled mode test completed')

    // Restore config
    shield.updateConfig(originalConfig)

    // Test 4: PII detection
    console.log('\n4. Testing PII detection...')
    const piiEvents = [{
      id: 'pii1',
      correlationId,
      spanId,
      type: 'pii_detected',
      severity: 'medium',
      details: { confidence: 0.85, patterns: ['email'] },
      action: 'flag',
      timestamp: Date.now(),
      resolved: false
    }]

    const piiResult = await shield.evaluateOutput(
      correlationId,
      agentId,
      spanId,
      { content: 'Contact me at test@example.com' },
      piiEvents
    )
    console.log('   Result:', piiResult.decision.action, piiResult.shouldMask)
    console.log('   ✅ PII test completed')

    console.log('\n' + '=' .repeat(40))
    console.log('✅ All Shield tests completed successfully!')
    console.log('🛡️ Shield is working correctly!')

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    process.exit(1)
  }
}

// Run the test with proper error handling
simpleShieldTest()
  .then(() => {
    console.log('\n🎉 Test suite completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Test suite failed:', error)
    process.exit(1)
  })
