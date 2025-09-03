#!/usr/bin/env node

/**
 * Gateway Diagnostic Script
 * 
 * Purpose: Check Gateway connectivity and show detailed error information
 */

const http = require('http');

const GATEWAY_URL = 'http://localhost:3000';

function testEndpoint(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, GATEWAY_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token-s2-harness',
        'X-Workspace-ID': 's2-diagnostic',
        'X-Test-Bypass': 'true'
      }
    };

    console.log(`🔍 Testing ${method} ${path}...`);

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   Headers: ${JSON.stringify(res.headers, null, 2)}`);
        console.log(`   Body: ${body.substring(0, 500)}`);
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    });

    req.on('error', (error) => {
      console.log(`   ❌ Error: ${error.message}`);
      console.log(`   Code: ${error.code}`);
      console.log(`   Stack: ${error.stack}`);
      reject(error);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function runDiagnostics() {
  console.log('🔍 Gateway Diagnostics');
  console.log('======================');
  console.log(`Gateway URL: ${GATEWAY_URL}`);
  console.log('');

  try {
    // Test basic connectivity
    console.log('1. Testing basic connectivity...');
    await testEndpoint('/health');
    console.log('');

    // Test ready endpoint
    console.log('2. Testing ready endpoint...');
    await testEndpoint('/ready');
    console.log('');

    // Test SSE endpoint
    console.log('3. Testing SSE endpoint...');
    await testEndpoint('/api/runs/logs/stream');
    console.log('');

    // Test workspace plan
    console.log('4. Testing workspace plan...');
    await testEndpoint('/api/workspace/plan', 'POST', { plan: 'pro' });
    console.log('');

    // Test run creation
    console.log('5. Testing run creation...');
    await testEndpoint('/api/runs', 'POST', {
      id: 'test-run-123',
      name: 'Test Run',
      workspace_id: 's2-diagnostic'
    });
    console.log('');

    console.log('✅ All tests completed successfully!');

  } catch (error) {
    console.log('');
    console.log('❌ Diagnostic failed:');
    console.log(`   Error: ${error.message}`);
    console.log(`   Code: ${error.code}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('');
      console.log('🔧 Troubleshooting:');
      console.log('   - Gateway is not running on port 3000');
      console.log('   - Check if Gateway service is started');
      console.log('   - Verify no firewall blocking port 3000');
    } else if (error.code === 'ENOTFOUND') {
      console.log('');
      console.log('🔧 Troubleshooting:');
      console.log('   - DNS resolution failed for localhost');
      console.log('   - Check hosts file configuration');
    }
  }
}

// Run diagnostics
runDiagnostics().catch(error => {
  console.error('💥 Fatal diagnostic error:', error);
  process.exit(1);
});
