const http = require('http');

// Test SSE connection to the real Gateway using S2 harness pattern
async function testS2SSE() {
  console.log('🧪 Testing S2 SSE pattern with REAL Gateway...');
  
  const CONFIG = {
    GATEWAY_URL: 'http://localhost:3000',
    WORKSPACE_ID: 's2-unkillable',
    TEST_TOKEN: 'test-token-s2-harness',
    TEST_BYPASS: true
  };
  
  function getAuthHeaders() {
    const headers = {
      'Authorization': `Bearer ${CONFIG.TEST_TOKEN}`,
      'X-Workspace-ID': CONFIG.WORKSPACE_ID,
      'Content-Type': 'application/json'
    };
    if (CONFIG.TEST_BYPASS) {
      headers['X-Test-Bypass'] = 'true';
    }
    return headers;
  }
  
  // Test SSE connection using S2 harness pattern (without run ID)
  const url = new URL('/api/runs/logs/stream', CONFIG.GATEWAY_URL);
  
  console.log(`Testing SSE connection to: ${url.toString()}`);
  console.log('Headers:', getAuthHeaders());
  
  const options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method: 'GET',
    headers: getAuthHeaders()
  };
  
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      console.log(`Response status: ${res.statusCode}`);
      console.log('Response headers:', res.headers);
      
      if (res.statusCode === 200) {
        console.log('✅ SSE connection successful! Real Gateway accepts S2 harness pattern.');
        
        let messageCount = 0;
        res.on('data', (chunk) => {
          const data = chunk.toString();
          console.log(`SSE data: ${data.trim()}`);
          messageCount++;
          
          if (messageCount >= 3) {
            console.log('✅ Received 3 SSE messages - test successful!');
            req.destroy(); // Close connection
            resolve(true);
          }
        });
        
        res.on('end', () => {
          console.log('SSE connection ended');
          resolve(true);
        });
      } else {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          console.error(`❌ SSE connection failed: ${res.statusCode} - ${body}`);
          resolve(false);
        });
      }
    });
    
    req.on('error', (error) => {
      console.error('Request error:', error.message);
      reject(error);
    });
    
    req.end();
  });
}

// Run the test
testS2SSE().then(success => {
  if (success) {
    console.log('\n🚀 S2 SSE test passed! The REAL Gateway now handles S2 harness pattern correctly.');
    console.log('You can now run the full S2 test:');
    console.log('node s2-harness-unkillable-fixed.js --duration 15 --sse 20 --sse-churn 300000');
  } else {
    console.log('\n❌ S2 SSE test failed. Check the Gateway logs.');
  }
});
