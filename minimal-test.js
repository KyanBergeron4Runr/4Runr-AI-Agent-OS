const axios = require('axios');

const BASE = 'http://localhost:9999';
const key = '550e8400-e29b-41d4-a716-446655440000';
const body = { name: "minimal-test", params: { test: 1 } };

async function minimalTest() {
  console.log('🧪 Minimal Idempotency Test');
  console.log(`🔑 Key: ${key}`);
  console.log(`📝 Body: ${JSON.stringify(body)}`);
  console.log('');
  
  try {
    // First request
    console.log('📤 Request 1...');
    const response1 = await axios.post(`${BASE}/api/runs`, body, {
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }
    });
    console.log(`✅ Status: ${response1.status}`);
    console.log(`   ID: ${response1.data.run.id}`);
    console.log(`   Time: ${response1.data.run.created_at}`);
    
    // Wait
    console.log('\n⏳ Waiting...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Second request
    console.log('\n📤 Request 2...');
    const response2 = await axios.post(`${BASE}/api/runs`, body, {
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }
    });
    console.log(`✅ Status: ${response2.status}`);
    console.log(`   ID: ${response2.data.run.id}`);
    console.log(`   Time: ${response2.data.run.created_at}`);
    
    // Check
    console.log('\n🔍 Check:');
    console.log(`   Same ID: ${response1.data.run.id === response2.data.run.id}`);
    console.log(`   Same Time: ${response1.data.run.created_at === response2.data.run.created_at}`);
    console.log(`   Expected: 1st=201, 2nd=200`);
    console.log(`   Actual: 1st=${response1.status}, 2nd=${response2.status}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

minimalTest();
