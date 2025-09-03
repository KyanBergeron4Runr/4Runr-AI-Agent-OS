const http = require('http');

// Test the exact same request the S2 harness makes
async function testS2Request() {
  console.log('🧪 Testing S2 harness request...');
  
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
  
  function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, CONFIG.GATEWAY_URL);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: getAuthHeaders()
      };

      console.log('Making request:', {
        method,
        path,
        headers: options.headers,
        data
      });

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const response = {
              status: res.statusCode,
              headers: res.headers,
              data: body ? JSON.parse(body) : null,
              body: body
            };
            console.log('Response:', response);
            resolve(response);
          } catch (error) {
            const response = { 
              status: res.statusCode, 
              headers: res.headers, 
              data: body,
              body: body 
            };
            console.log('Response (raw):', response);
            resolve(response);
          }
        });
      });

      req.on('error', (error) => {
        console.error('Request error:', error.message);
        reject(error);
      });
      
      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }
  
  try {
    console.log('Testing workspace plan setup...');
    const response = await makeRequest('POST', '/api/workspace/plan', { plan: 'pro' });
    
    if (response.status !== 200) {
      console.error(`❌ Failed to set workspace plan: ${response.status} - ${JSON.stringify(response.data)}`);
      return false;
    }
    
    console.log('✅ Workspace plan set to pro');
    return true;
  } catch (error) {
    console.error(`❌ Error setting workspace plan: ${error.message}`);
    return false;
  }
}

// Run the test
testS2Request().then(success => {
  if (success) {
    console.log('\n🚀 S2 request works! You can now run the full S2 test.');
    console.log('Command: node s2-harness-unkillable-fixed.js --duration 15 --sse 20 --sse-churn 300000');
  } else {
    console.log('\n❌ S2 request failed. Check the Gateway logs.');
  }
});
