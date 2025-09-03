const axios = require('axios');

const BASE = 'http://localhost:3000';
const key = '550e8400-e29b-41d4-a716-446655440000';
const body = { name: "test-run", params: { test: true } };

async function testIdempotency() {
  console.log('🧪 Testing Idempotency Sequentially');
  console.log(`🔑 Key: ${key}`);
  console.log(`📝 Body: ${JSON.stringify(body)}`);
  console.log('');
  
  try {
    // First request - should create (201)
    console.log('📤 Request 1: Creating run...');
    const response1 = await axios.post(`${BASE}/api/runs`, body, {
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }
    });
    console.log(`✅ Response 1: Status ${response1.status}, Run ID: ${response1.data.run.id}`);
    
    // Wait a moment for storage
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Second request - should return cached (200)
    console.log('\n📤 Request 2: Same key + body...');
    const response2 = await axios.post(`${BASE}/api/runs`, body, {
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }
    });
    console.log(`✅ Response 2: Status ${response2.status}, Run ID: ${response2.data.run.id}`);
    
    // Third request - different body should conflict (409)
    console.log('\n📤 Request 3: Same key + different body...');
    const differentBody = { name: "different-run", params: { test: false } };
    const response3 = await axios.post(`${BASE}/api/runs`, differentBody, {
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      validateStatus: () => true
    });
    console.log(`✅ Response 3: Status ${response3.status}`);
    
    // Analysis
    console.log('\n📊 Analysis:');
    if (response1.status === 201 && response2.status === 200) {
      console.log('✅ SUCCESS: Idempotency working for same key + body');
    } else {
      console.log('❌ FAILURE: Idempotency not working for same key + body');
    }
    
    if (response3.status === 409) {
      console.log('✅ SUCCESS: Conflict detected for same key + different body');
    } else {
      console.log('❌ FAILURE: No conflict detected for same key + different body');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testIdempotency();
