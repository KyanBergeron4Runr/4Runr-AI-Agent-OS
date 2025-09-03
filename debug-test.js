const axios = require('axios');
const { v4: uuid } = require('uuid');

const BASE = 'http://localhost:3000';
const key = uuid(); // Fresh UUID for each test
const body = { name: "debug-run", params: { debug: true } };

async function debugIdempotency() {
  console.log('🔍 Debugging Idempotency Step by Step');
  console.log(`🔑 Key: ${key}`);
  console.log(`📝 Body: ${JSON.stringify(body)}`);
  console.log('');
  
  try {
    // First request
    console.log('📤 Request 1: Creating run...');
    const response1 = await axios.post(`${BASE}/api/runs`, body, {
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }
    });
    console.log(`✅ Response 1: Status ${response1.status}`);
    console.log(`   Run ID: ${response1.data.run.id}`);
    console.log(`   Response: ${JSON.stringify(response1.data)}`);
    
    // Wait and check gateway logs
    console.log('\n⏳ Waiting 2 seconds for gateway to process...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Second request
    console.log('\n📤 Request 2: Same key + body...');
    const response2 = await axios.post(`${BASE}/api/runs`, body, {
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }
    });
    console.log(`✅ Response 2: Status ${response2.status}`);
    console.log(`   Run ID: ${response2.data.run.id}`);
    console.log(`   Response: ${JSON.stringify(response2.data)}`);
    
    // Analysis
    console.log('\n📊 Analysis:');
    if (response1.status === 201 && response2.status === 200) {
      console.log('✅ SUCCESS: Idempotency working!');
    } else if (response1.status === 201 && response2.status === 201) {
      console.log('❌ FAILURE: Both requests created runs (idempotency not working)');
      console.log(`   Run 1 ID: ${response1.data.run.id}`);
      console.log(`   Run 2 ID: ${response2.data.run.id}`);
      console.log(`   Same ID: ${response1.data.run.id === response2.data.run.id}`);
    } else {
      console.log('⚠️  UNEXPECTED: Mixed results');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

debugIdempotency();
