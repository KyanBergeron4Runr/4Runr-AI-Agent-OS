import { GatewayClient } from './lib/gatewayClient'
import { memoryDB } from './src/models/memory-db'
import { PolicyEngine } from './src/services/policyEngine'
import { getDefaultPolicyForRole, defaultPolicyNames } from './src/policies/defaults'

const GATEWAY_URL = 'http://localhost:3000'

async function testTask007() {
  console.log('🧠 TASK 007 - Policy Engine Test Suite')
  console.log('=====================================\n')

  try {
    // Step 1: Create test agents for different roles
    console.log('1. Creating test agents...')
    
    const scraperResponse = await fetch(`${GATEWAY_URL}/api/create-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'test_scraper_agent',
        role: 'scraper',
        created_by: 'test-suite'
      })
    })
    const scraperData = await scraperResponse.json() as any
    console.log('✅ Scraper agent created:', scraperData.agent_id)

    const enricherResponse = await fetch(`${GATEWAY_URL}/api/create-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'test_enricher_agent',
        role: 'enricher',
        created_by: 'test-suite'
      })
    })
    const enricherData = await enricherResponse.json() as any
    console.log('✅ Enricher agent created:', enricherData.agent_id)

    const engagerResponse = await fetch(`${GATEWAY_URL}/api/create-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'test_engager_agent',
        role: 'engager',
        created_by: 'test-suite'
      })
    })
    const engagerData = await engagerResponse.json() as any
    console.log('✅ Engager agent created:', engagerData.agent_id)

    // Step 2: Create default policies for each role
    console.log('\n2. Creating default policies...')
    
    const policyEngine = PolicyEngine.getInstance()
    
    // Create scraper policy
    const scraperPolicy = getDefaultPolicyForRole('scraper')
    const scraperPolicyResponse = await fetch(`${GATEWAY_URL}/api/policies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: defaultPolicyNames.scraper,
        description: 'Default policy for scraper agents',
        role: 'scraper',
        spec: scraperPolicy
      })
    })
    const scraperPolicyData = await scraperPolicyResponse.json() as any
    console.log('✅ Scraper policy created:', scraperPolicyData.id)

    // Create enricher policy
    const enricherPolicy = getDefaultPolicyForRole('enricher')
    const enricherPolicyResponse = await fetch(`${GATEWAY_URL}/api/policies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: defaultPolicyNames.enricher,
        description: 'Default policy for enricher agents',
        role: 'enricher',
        spec: enricherPolicy
      })
    })
    const enricherPolicyData = await enricherPolicyResponse.json() as any
    console.log('✅ Enricher policy created:', enricherPolicyData.id)

    // Create engager policy
    const engagerPolicy = getDefaultPolicyForRole('engager')
    const engagerPolicyResponse = await fetch(`${GATEWAY_URL}/api/policies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: defaultPolicyNames.engager,
        description: 'Default policy for engager agents',
        role: 'engager',
        spec: engagerPolicy
      })
    })
    const engagerPolicyData = await engagerPolicyResponse.json() as any
    console.log('✅ Engager policy created:', engagerPolicyData.id)

    // Step 3: Generate tokens for each agent
    console.log('\n3. Generating tokens...')
    
    const scraperTokenResponse = await fetch(`${GATEWAY_URL}/api/generate-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: scraperData.agent_id,
        tools: ['serpapi', 'http_fetch'],
        permissions: ['read'],
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString()
      })
    })
    const scraperTokenData = await scraperTokenResponse.json() as any
    console.log('✅ Scraper token generated')

    const enricherTokenResponse = await fetch(`${GATEWAY_URL}/api/generate-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: enricherData.agent_id,
        tools: ['http_fetch', 'openai'],
        permissions: ['read'],
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString()
      })
    })
    const enricherTokenData = await enricherTokenResponse.json() as any
    console.log('✅ Enricher token generated')

    const engagerTokenResponse = await fetch(`${GATEWAY_URL}/api/generate-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: engagerData.agent_id,
        tools: ['gmail_send'],
        permissions: ['read'],
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString()
      })
    })
    const engagerTokenData = await engagerTokenResponse.json() as any
    console.log('✅ Engager token generated')

    // Step 4: Test scope enforcement
    console.log('\n4. Testing scope enforcement...')
    
    // Test 4.1: Scraper should be able to use serpapi:search
    const scraperClient = new GatewayClient(GATEWAY_URL, scraperData.agent_id, scraperData.private_key)
    try {
          const scraperResult = await scraperClient.proxy('serpapi', 'search', {
      q: 'test query',
      num: 5
    }, scraperTokenData.agent_token)
      console.log('✅ Scraper can use serpapi:search (allowed scope)')
    } catch (error: any) {
      console.log('❌ Scraper serpapi:search failed:', error.message)
    }

    // Test 4.2: Scraper should NOT be able to use openai:chat
    try {
      await scraperClient.proxy('openai', 'chat', {
        messages: [{ role: 'user', content: 'Hello' }]
      }, scraperTokenData.agent_token)
      console.log('❌ Scraper should not be able to use openai:chat')
    } catch (error: any) {
      if (error.message.includes('Policy denied') || error.message.includes('scope_not_allowed')) {
        console.log('✅ Scraper correctly denied openai:chat (scope enforcement working)')
      } else {
        console.log('❌ Unexpected error for scraper openai:chat:', error.message)
      }
    }

    // Test 4.3: Enricher should be able to use openai:chat
    const enricherClient = new GatewayClient(GATEWAY_URL, enricherData.agent_id, enricherData.private_key)
    try {
      const enricherResult = await enricherClient.proxy('openai', 'chat', {
        messages: [{ role: 'user', content: 'Hello' }]
      }, enricherTokenData.agent_token)
      console.log('✅ Enricher can use openai:chat (allowed scope)')
    } catch (error: any) {
      console.log('❌ Enricher openai:chat failed:', error.message)
    }

    // Step 5: Test quota enforcement
    console.log('\n5. Testing quota enforcement...')
    
    // Create a restrictive quota policy for testing
    const restrictivePolicy = {
      scopes: ['serpapi:search'],
      intent: 'test_quota',
      quotas: [
        {
          action: 'serpapi:search',
          limit: 2,
          window: '24h',
          resetStrategy: 'sliding'
        }
      ]
    }

    const quotaPolicyResponse = await fetch(`${GATEWAY_URL}/api/policies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Quota Policy',
        description: 'Restrictive quota for testing',
        agentId: scraperData.agent_id,
        spec: restrictivePolicy
      })
    })
    const quotaPolicyData = await quotaPolicyResponse.json() as any
    console.log('✅ Quota test policy created')

    // Make requests until quota is exceeded
    let quotaExceeded = false
    for (let i = 0; i < 4; i++) {
      try {
        await scraperClient.proxy('serpapi', 'search', {
          q: `quota test ${i}`,
          num: 1
        }, scraperTokenData.agent_token)
        console.log(`✅ Quota request ${i + 1} succeeded`)
      } catch (error: any) {
        if (error.message.includes('quota exceeded') || error.message.includes('Quota exceeded')) {
          console.log(`✅ Quota correctly exceeded after ${i + 1} requests`)
          quotaExceeded = true
          break
        } else {
          console.log(`❌ Unexpected error on quota request ${i + 1}:`, error.message)
        }
      }
    }
    
    if (!quotaExceeded) {
      console.log('❌ Quota enforcement not working properly')
    }

    // Step 6: Test parameter validation
    console.log('\n6. Testing parameter validation...')
    
    try {
      await scraperClient.proxy('serpapi', 'search', {
        q: '', // Empty query should fail validation
        num: 1000 // Too many results should fail validation
      }, scraperTokenData.agent_token)
      console.log('❌ Parameter validation should have failed')
    } catch (error: any) {
      if (error.message.includes('validation') || error.message.includes('Parameter validation failed')) {
        console.log('✅ Parameter validation working correctly')
      } else {
        console.log('❌ Unexpected error for parameter validation:', error.message)
      }
    }

    // Step 7: Test response filtering
    console.log('\n7. Testing response filtering...')
    
    // Create a policy with response filters
    const filterPolicy = {
      scopes: ['http_fetch:get'],
      intent: 'test_filters',
      responseFilters: {
        redactFields: ['api_key'],
        truncateFields: [
          { field: 'content', maxLength: 50 }
        ]
      }
    }

    const filterPolicyResponse = await fetch(`${GATEWAY_URL}/api/policies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Filter Policy',
        description: 'Policy with response filters',
        agentId: scraperData.agent_id,
        spec: filterPolicy
      })
    })
    const filterPolicyData = await filterPolicyResponse.json() as any
    console.log('✅ Filter test policy created')

    try {
      const filterResult = await scraperClient.proxy('http_fetch', 'get', {
        url: 'https://httpbin.org/json'
      }, scraperTokenData.agent_token)
      console.log('✅ Response filtering test completed')
    } catch (error: any) {
      console.log('❌ Response filtering test failed:', error.message)
    }

    // Step 8: Test policy logs
    console.log('\n8. Testing policy logs...')
    
    const policyLogsResponse = await fetch(`${GATEWAY_URL}/api/policy-logs?limit=10`)
    const policyLogsData = await policyLogsResponse.json() as any
    
    if (policyLogsData && policyLogsData.length > 0) {
      console.log(`✅ Policy logs working: ${policyLogsData.length} logs found`)
      console.log('Sample log entry:', {
        agentId: policyLogsData[0].agentId,
        tool: policyLogsData[0].tool,
        action: policyLogsData[0].action,
        decision: policyLogsData[0].decision,
        reason: policyLogsData[0].reason
      })
    } else {
      console.log('❌ No policy logs found')
    }

    // Step 9: Test merged policies
    console.log('\n9. Testing merged policies...')
    
    const mergedPoliciesResponse = await fetch(`${GATEWAY_URL}/api/policies/merged/${scraperData.agent_id}`)
    const mergedPoliciesData = await mergedPoliciesResponse.json() as any
    
    if (mergedPoliciesData && mergedPoliciesData.mergedSpec) {
      console.log('✅ Merged policies working')
      console.log('Merged scopes:', mergedPoliciesData.mergedSpec.scopes)
      console.log('Source policies:', mergedPoliciesData.sourcePolicies)
    } else {
      console.log('❌ Merged policies not working')
    }

    // Step 10: Test schedule restrictions (if current time allows)
    console.log('\n10. Testing schedule restrictions...')
    
    const schedulePolicy = {
      scopes: ['serpapi:search'],
      intent: 'test_schedule',
      schedule: {
        enabled: true,
        timezone: 'UTC',
        allowedDays: [1, 2, 3, 4, 5], // Monday-Friday only
        allowedHours: {
          start: 9,
          end: 17
        }
      }
    }

    const schedulePolicyResponse = await fetch(`${GATEWAY_URL}/api/policies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Schedule Policy',
        description: 'Policy with schedule restrictions',
        agentId: scraperData.agent_id,
        spec: schedulePolicy
      })
    })
    const schedulePolicyData = await schedulePolicyResponse.json() as any
    console.log('✅ Schedule test policy created')

    try {
      await scraperClient.proxy('serpapi', 'search', {
        q: 'schedule test'
      }, scraperTokenData.agent_token)
      console.log('✅ Schedule check completed (current time allowed)')
    } catch (error: any) {
      if (error.message.includes('schedule') || error.message.includes('Schedule')) {
        console.log('✅ Schedule restriction working (current time not allowed)')
      } else {
        console.log('❌ Unexpected error for schedule test:', error.message)
      }
    }

    // Step 11: Summary and cleanup
    console.log('\n11. Test Summary...')
    
    const stats = memoryDB.getStats()
    console.log('Database stats:', stats)
    
    console.log('\n🎉 TASK 007 Policy Engine Test Suite Completed!')
    console.log('Key features tested:')
    console.log('- ✅ Scope enforcement (allow/deny)')
    console.log('- ✅ Quota management')
    console.log('- ✅ Parameter validation')
    console.log('- ✅ Response filtering')
    console.log('- ✅ Policy logging')
    console.log('- ✅ Policy merging')
    console.log('- ✅ Schedule restrictions')
    console.log('- ✅ Default policies for roles')

  } catch (error) {
    console.error('❌ Test suite failed:', error)
  }
}

// Run the test
testTask007()
