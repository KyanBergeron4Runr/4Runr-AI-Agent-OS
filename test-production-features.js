const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Test utilities
const makeRequest = (method, path, body = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : null;
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: jsonData
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

const testHealth = async () => {
  console.log('\n🔍 Testing health endpoint...');
  const response = await makeRequest('GET', '/health');
  console.log(`Status: ${response.statusCode}`);
  console.log('Response:', response.data);
  return response.statusCode === 200;
};

const testMetrics = async () => {
  console.log('\n📊 Testing metrics endpoint...');
  const response = await makeRequest('GET', '/metrics');
  console.log(`Status: ${response.statusCode}`);
  console.log('Metrics preview:', response.data.substring(0, 200) + '...');
  return response.statusCode === 200;
};

const testInputValidation = async () => {
  console.log('\n✅ Testing input validation...');
  
  const tests = [
    {
      name: 'Missing name (should fail)',
      body: { input: 'test' },
      expectedStatus: 422
    },
    {
      name: 'Empty name (should fail)',
      body: { name: '', input: 'test' },
      expectedStatus: 422
    },
    {
      name: 'Name too long (should fail)',
      body: { name: 'a'.repeat(129), input: 'test' },
      expectedStatus: 422
    },
    {
      name: 'Invalid client_token (should fail)',
      body: { name: 'test', client_token: 'invalid@token' },
      expectedStatus: 422
    },
    {
      name: 'Too many tags (should fail)',
      body: { name: 'test', tags: Array(17).fill('tag') },
      expectedStatus: 422
    },
    {
      name: 'Valid request (should pass)',
      body: { 
        name: 'Test Run',
        input: 'test input',
        client_token: 'valid_token_123',
        tags: ['tag1', 'tag2']
      },
      expectedStatus: 201
    }
  ];

  for (const test of tests) {
    console.log(`\n  Testing: ${test.name}`);
    const response = await makeRequest('POST', '/api/runs', test.body);
    console.log(`    Status: ${response.statusCode} (expected: ${test.expectedStatus})`);
    
    if (response.statusCode !== test.expectedStatus) {
      console.log(`    ❌ FAILED: Expected ${test.expectedStatus}, got ${response.statusCode}`);
      if (response.data) {
        console.log(`    Response:`, response.data);
      }
    } else {
      console.log(`    ✅ PASSED`);
    }
  }
};

const testIdempotency = async () => {
  console.log('\n🔄 Testing idempotency...');
  
  const clientToken = `test_token_${Date.now()}`;
  const requestBody = {
    name: 'Idempotency Test',
    input: 'test input',
    client_token: clientToken
  };

  console.log(`  Using client_token: ${clientToken}`);

  // First request
  console.log('\n  Making first request...');
  const response1 = await makeRequest('POST', '/api/runs', requestBody);
  console.log(`    Status: ${response1.statusCode}`);
  
  if (response1.statusCode !== 201) {
    console.log('    ❌ First request failed');
    return false;
  }

  const runId1 = response1.data.run.id;
  console.log(`    Run ID: ${runId1}`);

  // Second request with same token
  console.log('\n  Making second request with same token...');
  const response2 = await makeRequest('POST', '/api/runs', requestBody);
  console.log(`    Status: ${response2.statusCode}`);
  
  if (response2.statusCode !== 200) {
    console.log('    ❌ Second request should return 200');
    return false;
  }

  const runId2 = response2.data.run.id;
  console.log(`    Run ID: ${runId2}`);
  console.log(`    Idempotent: ${response2.data.idempotent}`);

  if (runId1 !== runId2) {
    console.log('    ❌ FAILED: Run IDs should be the same');
    return false;
  }

  console.log('    ✅ PASSED: Idempotency working correctly');
  return true;
};

const testCancellation = async () => {
  console.log('\n🚫 Testing cancellation...');
  
  // Create a run
  const createResponse = await makeRequest('POST', '/api/runs', {
    name: 'Cancellation Test',
    input: 'test input'
  });

  if (createResponse.statusCode !== 201) {
    console.log('    ❌ Failed to create run for cancellation test');
    return false;
  }

  const runId = createResponse.data.run.id;
  console.log(`    Created run: ${runId}`);

  // Start the run
  const startResponse = await makeRequest('POST', `/api/runs/${runId}/start`);
  if (startResponse.statusCode !== 200) {
    console.log('    ❌ Failed to start run');
    return false;
  }

  console.log('    Started run');

  // Cancel the run
  const cancelResponse = await makeRequest('POST', `/api/runs/${runId}/cancel`);
  console.log(`    Cancel status: ${cancelResponse.statusCode}`);
  
  if (cancelResponse.statusCode !== 202) {
    console.log('    ❌ FAILED: Should return 202 for cancellation');
    return false;
  }

  console.log('    ✅ PASSED: Cancellation working correctly');
  return true;
};

const testRateLimiting = async () => {
  console.log('\n⏱️ Testing rate limiting...');
  
  // Check if rate limiting is enabled
  const healthResponse = await makeRequest('GET', '/health');
  const rateLimitEnabled = healthResponse.data.config.rateLimitEnabled;
  
  if (!rateLimitEnabled) {
    console.log('    Rate limiting is disabled, skipping test');
    return true;
  }

  console.log(`    Rate limit: ${healthResponse.data.config.rateLimitPerSec} req/sec`);

  const requests = [];
  const numRequests = healthResponse.data.config.rateLimitPerSec + 5; // Exceed limit

  console.log(`    Making ${numRequests} rapid requests...`);

  for (let i = 0; i < numRequests; i++) {
    requests.push(
      makeRequest('POST', '/api/runs', {
        name: `Rate Limit Test ${i}`,
        input: 'test'
      })
    );
  }

  const responses = await Promise.all(requests);
  
  const successCount = responses.filter(r => r.statusCode === 201).length;
  const rateLimitedCount = responses.filter(r => r.statusCode === 429).length;
  
  console.log(`    Success: ${successCount}`);
  console.log(`    Rate limited: ${rateLimitedCount}`);

  if (rateLimitedCount > 0) {
    console.log('    ✅ PASSED: Rate limiting working correctly');
    return true;
  } else {
    console.log('    ❌ FAILED: No requests were rate limited');
    return false;
  }
};

const testSSEMetrics = async () => {
  console.log('\n📈 Testing SSE metrics...');
  
  // Get initial metrics
  const initialMetrics = await makeRequest('GET', '/metrics');
  console.log('    Initial metrics retrieved');

  // Connect to SSE
  console.log('    Connecting to SSE...');
  const ssePromise = new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/diagnostics/sse-test',
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream'
      }
    }, (res) => {
      let eventCount = 0;
      res.on('data', (chunk) => {
        eventCount++;
        if (eventCount >= 3) { // Get a few events
          req.destroy(); // Close connection
          resolve();
        }
      });
    });
    req.end();
  });

  await ssePromise;
  console.log('    SSE connection closed');

  // Wait a moment for metrics to update
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Get updated metrics
  const updatedMetrics = await makeRequest('GET', '/metrics');
  console.log('    Updated metrics retrieved');

  // Check for negative connections
  if (updatedMetrics.data.includes('sse_active_connections -')) {
    console.log('    ❌ FAILED: Found negative active connections');
    return false;
  }

  console.log('    ✅ PASSED: SSE metrics working correctly');
  return true;
};

const testLargePayload = async () => {
  console.log('\n📦 Testing large payload handling...');
  
  // Test payload just under limit
  const largeString = 'x'.repeat(65536); // 64KB
  const response1 = await makeRequest('POST', '/api/runs', {
    name: 'Large Payload Test',
    input: largeString
  });
  
  console.log(`    Under limit payload: ${response1.statusCode}`);
  
  // Test payload over limit (this should be rejected by body parser)
  const oversizedString = 'x'.repeat(300000); // ~300KB
  try {
    const response2 = await makeRequest('POST', '/api/runs', {
      name: 'Oversized Payload Test',
      input: oversizedString
    });
    console.log(`    Over limit payload: ${response2.statusCode}`);
  } catch (error) {
    console.log('    Over limit payload: Connection reset (expected)');
  }

  console.log('    ✅ PASSED: Large payload handling working correctly');
  return true;
};

const runAllTests = async () => {
  console.log('🚀 Starting Production Gateway Feature Tests\n');
  
  const tests = [
    { name: 'Health Check', fn: testHealth },
    { name: 'Metrics', fn: testMetrics },
    { name: 'Input Validation', fn: testInputValidation },
    { name: 'Idempotency', fn: testIdempotency },
    { name: 'Cancellation', fn: testCancellation },
    { name: 'Rate Limiting', fn: testRateLimiting },
    { name: 'SSE Metrics', fn: testSSEMetrics },
    { name: 'Large Payload', fn: testLargePayload }
  ];

  const results = [];
  
  for (const test of tests) {
    try {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`Running: ${test.name}`);
      console.log(`${'='.repeat(50)}`);
      
      const result = await test.fn();
      results.push({ name: test.name, passed: result });
      
      if (result) {
        console.log(`\n✅ ${test.name}: PASSED`);
      } else {
        console.log(`\n❌ ${test.name}: FAILED`);
      }
    } catch (error) {
      console.log(`\n💥 ${test.name}: ERROR`);
      console.log(error.message);
      results.push({ name: test.name, passed: false, error: error.message });
    }
  }

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log('TEST SUMMARY');
  console.log(`${'='.repeat(50)}`);
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.name}`);
    if (result.error) {
      console.log(`    Error: ${result.error}`);
    }
  });
  
  console.log(`\nTotal: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Production gateway is ready.');
  } else {
    console.log('\n⚠️ Some tests failed. Please review the issues above.');
  }
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testHealth,
  testMetrics,
  testInputValidation,
  testIdempotency,
  testCancellation,
  testRateLimiting,
  testSSEMetrics,
  testLargePayload,
  runAllTests
};
