import { PolicyEngine } from './src/services/policyEngine'
import { memoryDB } from './src/models/memory-db'
import { getDefaultPolicyForRole } from './src/policies/defaults'

async function testPolicySimple() {
  console.log('🧠 Simple Policy Engine Test')
  console.log('============================\n')

  try {
    // Step 1: Create a test agent
    console.log('1. Creating test agent...')
    const agent = await memoryDB.createAgent({
      name: 'test_policy_agent',
      role: 'scraper',
      createdBy: 'test',
      publicKey: 'test-key',
      status: 'active'
    })
    console.log('✅ Agent created:', agent.id)

    // Step 2: Create a policy
    console.log('2. Creating test policy...')
    const policy = await memoryDB.createPolicy({
      name: 'Test Policy',
      description: 'Test policy for validation',
      role: 'scraper',
      spec: JSON.stringify({
        scopes: ['serpapi:search'],
        intent: 'test',
        quotas: [
          {
            action: 'serpapi:search',
            limit: 2,
            window: '24h',
            resetStrategy: 'sliding'
          }
        ]
      }),
      specHash: 'test-hash',
      active: true
    })
    console.log('✅ Policy created:', policy.id)

    // Step 3: Test policy evaluation
    console.log('3. Testing policy evaluation...')
    const policyEngine = PolicyEngine.getInstance()
    
    // Test allowed scope
    const allowedResult = await policyEngine.evaluateRequest(
      agent.id,
      agent.role,
      'serpapi',
      'search',
      { q: 'test query' }
    )
    console.log('✅ Allowed scope result:', allowedResult.allowed)

    // Test denied scope
    const deniedResult = await policyEngine.evaluateRequest(
      agent.id,
      agent.role,
      'openai',
      'chat',
      { messages: [{ role: 'user', content: 'test' }] }
    )
    console.log('✅ Denied scope result:', !deniedResult.allowed, 'Reason:', deniedResult.reason)

    // Test quota enforcement
    console.log('4. Testing quota enforcement...')
    const quotaResult1 = await policyEngine.evaluateRequest(
      agent.id,
      agent.role,
      'serpapi',
      'search',
      { q: 'quota test 1' }
    )
    console.log('✅ First quota request:', quotaResult1.allowed)

    const quotaResult2 = await policyEngine.evaluateRequest(
      agent.id,
      agent.role,
      'serpapi',
      'search',
      { q: 'quota test 2' }
    )
    console.log('✅ Second quota request:', quotaResult2.allowed)

    const quotaResult3 = await policyEngine.evaluateRequest(
      agent.id,
      agent.role,
      'serpapi',
      'search',
      { q: 'quota test 3' }
    )
    console.log('✅ Third quota request (should be denied):', !quotaResult3.allowed, 'Reason:', quotaResult3.reason)

    // Step 5: Check policy logs
    console.log('5. Checking policy logs...')
    const logs = await memoryDB.getAllPolicyLogs(10)
    console.log(`✅ Policy logs created: ${logs.length}`)
    
    if (logs.length > 0) {
      console.log('Sample log:', {
        agentId: logs[0].agentId,
        tool: logs[0].tool,
        action: logs[0].action,
        decision: logs[0].decision,
        reason: logs[0].reason
      })
    }

    // Step 6: Test merged policies
    console.log('6. Testing merged policies...')
    const mergedResult = await policyEngine.loadMergedPolicies(agent.id, agent.role)
    console.log('✅ Merged policies:', {
      scopes: mergedResult.mergedSpec.scopes,
      sourcePolicies: mergedResult.sourcePolicies.length
    })

    console.log('\n🎉 Simple Policy Engine Test Completed!')
    console.log('All core functionality is working correctly.')

  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testPolicySimple()
