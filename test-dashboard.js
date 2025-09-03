// Test script to verify dashboard functionality
const BASE_URL = 'http://localhost:3000';

async function testDashboard() {
  console.log('🧪 Testing 4Runr Dashboard Integration...\n');

  try {
    // Test 1: Health check
    console.log('1️⃣ Testing Gateway health...');
    const health = await fetch(`${BASE_URL}/health`);
    if (health.ok) {
      const healthData = await health.json();
      console.log('✅ Gateway is healthy:', healthData.status);
    } else {
      throw new Error(`Gateway health check failed: ${health.status}`);
    }

    // Test 2: Get agents
    console.log('\n2️⃣ Testing agents API...');
    const agents = await fetch(`${BASE_URL}/api/agents`);
    if (agents.ok) {
      const agentsData = await agents.json();
      console.log(`✅ Found ${agentsData.length} agents`);
      
      if (agentsData.length > 0) {
        const agent = agentsData[0];
        console.log(`   - Agent: ${agent.name} (${agent.status})`);
        
        // Test 3: Get agent status
        console.log('\n3️⃣ Testing agent status...');
        const status = await fetch(`${BASE_URL}/api/agents/${agent.id}/status`);
        if (status.ok) {
          const statusData = await status.json();
          console.log('✅ Agent status retrieved');
          console.log(`   - Current status: ${statusData.agent.status}`);
          console.log(`   - Last run: ${statusData.lastRun?.status || 'None'}`);
        }

        // Test 4: Get agent metrics
        console.log('\n4️⃣ Testing agent metrics...');
        const metrics = await fetch(`${BASE_URL}/api/agents/${agent.id}/metrics`);
        if (metrics.ok) {
          const metricsData = await metrics.json();
          console.log('✅ Agent metrics retrieved');
          console.log(`   - Total runs: ${metricsData.summary.totalRuns}`);
          console.log(`   - Success rate: ${metricsData.summary.successRate}%`);
        }

        // Test 5: Get agent schedules
        console.log('\n5️⃣ Testing agent schedules...');
        const schedules = await fetch(`${BASE_URL}/api/agents/${agent.id}/schedules`);
        if (schedules.ok) {
          const schedulesData = await schedules.json();
          console.log(`✅ Found ${schedulesData.schedules.length} schedules`);
        }
      }
    } else {
      throw new Error(`Agents API failed: ${agents.status}`);
    }

    console.log('\n🎉 All tests passed! Dashboard should work correctly.');
    console.log('\n📋 Next steps:');
    console.log('   1. Start the dashboard: cd apps/dashboard && npm run dev');
    console.log('   2. Open http://localhost:3000 in your browser');
    console.log('   3. You should see the agents list and be able to interact with them');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Make sure the Gateway server is running on port 3000');
    console.log('   2. Check that all environment variables are set');
    console.log('   3. Verify the database is accessible');
  }
}

testDashboard();
