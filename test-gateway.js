const http = require('http');

// Test the Gateway endpoints
async function testGateway() {
  console.log('🧪 Testing Gateway endpoints...');
  
  const baseUrl = 'http://localhost:3000';
  
  try {
    // Test health endpoint
    console.log('Testing /health...');
    const healthResponse = await makeRequest(`${baseUrl}/health`);
    console.log('✅ Health endpoint:', healthResponse);
    
    // Test workspace plan endpoint
    console.log('Testing /api/workspace/plan...');
    const planResponse = await makeRequest(`${baseUrl}/api/workspace/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'pro' })
    });
    console.log('✅ Workspace plan endpoint:', planResponse);
    
    // Test create run endpoint
    console.log('Testing /api/runs...');
    const runResponse = await makeRequest(`${baseUrl}/api/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Run', input: 'test input' })
    });
    console.log('✅ Create run endpoint:', runResponse);
    
    console.log('🎉 All Gateway endpoints working!');
    return true;
    
  } catch (error) {
    console.error('❌ Gateway test failed:', error.message);
    return false;
  }
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    
    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// Run the test
testGateway().then(success => {
  if (success) {
    console.log('\n🚀 Gateway is ready! You can now run the S2 test.');
    console.log('Command: node s2-harness-unkillable-fixed.js --duration 15 --sse 20 --sse-churn 300000');
  } else {
    console.log('\n❌ Gateway is not working. Please start it first.');
    console.log('Command: node simple-gateway.js');
  }
});
