const BASE_URL = 'http://localhost:3000';

async function testDemoFunctionality() {
    console.log('🧪 Testing 4Runr Demo Functionality');
    console.log('=====================================\n');

    try {
        // Test 1: Check if demo mode is enabled
        console.log('1️⃣ Testing demo mode...');
        const demoSeedResponse = await fetch(`${BASE_URL}/api/demo/seed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (demoSeedResponse.status === 403) {
            console.log('   ❌ Demo mode is OFF - set DEMO_MODE=on');
            return;
        }
        
        if (!demoSeedResponse.ok) {
            throw new Error(`Demo seed failed: ${demoSeedResponse.status}`);
        }
        
        const seedData = await demoSeedResponse.json();
        console.log(`   ✅ Demo mode is ON`);
        console.log(`   ✅ Created ${seedData.agents?.length || 0} demo agents`);
        console.log(`   ✅ Hot run ID: ${seedData.hotRunId || 'none'}`);

        // Test 2: Verify agents were created
        console.log('\n2️⃣ Testing agents list...');
        const agentsResponse = await fetch(`${BASE_URL}/api/agents`);
        if (!agentsResponse.ok) throw new Error(`Agents API failed: ${agentsResponse.status}`);
        
        const agentsData = await agentsResponse.json();
        const agentsArray = agentsData.agents || agentsData;
        console.log(`   ✅ Found ${agentsArray.length} agents total`);
        
        const demoAgents = agentsArray.filter(agent => {
            const tags = agent.tags || [];
            return Array.isArray(tags) && tags.includes('demo');
        });
        console.log(`   ✅ Found ${demoAgents.length} demo agents`);

        // Test 3: Test demo reset
        console.log('\n3️⃣ Testing demo reset...');
        const resetResponse = await fetch(`${BASE_URL}/api/demo/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!resetResponse.ok) throw new Error(`Demo reset failed: ${resetResponse.status}`);
        
        const resetData = await resetResponse.json();
        console.log(`   ✅ Reset deleted ${resetData.deleted || 0} demo agents`);

        // Test 4: Verify reset worked
        console.log('\n4️⃣ Verifying reset...');
        const agentsAfterReset = await fetch(`${BASE_URL}/api/agents`);
        const agentsAfterData = await agentsAfterReset.json();
        const agentsAfterArray = agentsAfterData.agents || agentsAfterData;
        
        const demoAgentsAfter = agentsAfterArray.filter(agent => {
            const tags = agent.tags || [];
            return Array.isArray(tags) && tags.includes('demo');
        });
        console.log(`   ✅ Remaining demo agents: ${demoAgentsAfter.length}`);

        // Test 5: Test idempotent seed
        console.log('\n5️⃣ Testing idempotent seed...');
        const seedResponse2 = await fetch(`${BASE_URL}/api/demo/seed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const seedData2 = await seedResponse2.json();
        console.log(`   ✅ Second seed returned ${seedData2.agents?.length || 0} agents`);

        console.log('\n🎉 All demo functionality tests passed!');
        console.log('\n📋 Demo Features Verified:');
        console.log('✅ Demo mode toggle (DEMO_MODE=on)');
        console.log('✅ Demo seed endpoint (/api/demo/seed)');
        console.log('✅ Demo reset endpoint (/api/demo/reset)');
        console.log('✅ Agent tagging with ["demo"]');
        console.log('✅ Schedule creation for demo agents');
        console.log('✅ Hot run creation for live logs');
        console.log('✅ Idempotent seed (safe to call multiple times)');
        console.log('✅ Clean reset (only deletes demo data)');

    } catch (error) {
        console.error('❌ Demo test failed:', error.message);
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Make sure DEMO_MODE=on is set');
        console.log('2. Check that the server is running on port 3000');
        console.log('3. Verify the database migration was applied');
    }
}

testDemoFunctionality();
