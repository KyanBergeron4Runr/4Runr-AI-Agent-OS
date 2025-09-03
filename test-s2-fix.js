#!/usr/bin/env node

// Import the fixed makeRequest function from the S2 test
const { makeRequest } = require('./s2-long-haul-soak-short.js');

async function testS2Connection() {
  console.log('🔍 Testing S2 test connection to gateway...');
  
  try {
    const response = await makeRequest('GET', '/ready');
    console.log('✅ S2 test can connect to gateway:', response.status);
    console.log('📄 Response:', response.data);
    
    // Test a simple agent run
    console.log('🚀 Testing agent run...');
    const runResponse = await makeRequest('POST', '/api/agents/demo-enricher/run', {
      workspace_id: 'test-s2-fix'
    });
    console.log('✅ Agent run response:', runResponse.status);
    
  } catch (error) {
    console.log('❌ S2 test connection failed:', error.message);
  }
}

testS2Connection();
