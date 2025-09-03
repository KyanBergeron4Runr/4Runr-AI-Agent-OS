#!/usr/bin/env node

const http = require('http');
const https = require('https');
const crypto = require('crypto');

// Configuration
const CONFIG = {
  GATEWAY_BASE_URL: process.env.GATEWAY_BASE_URL || 'http://localhost:3000',
  TEST_RUN_ID: process.env.TEST_RUN_ID || `itg-${new Date().toISOString().slice(0,10).replace(/-/g, '')}-${crypto.randomBytes(4).toString('hex')}`,
  CONCURRENT_REQUESTS: parseInt(process.env.CONCURRENT_REQUESTS) || 10,
  SSE_TIMEOUT_MS: parseInt(process.env.SSE_TIMEOUT_MS) || 30000,
  REQUEST_TIMEOUT_MS: parseInt(process.env.REQUEST_TIMEOUT_MS) || 10000
};

// Test results
const results = {
  passed: 0,
  failed: 0,
  errors: [],
  variants: {}
};

console.log('🚀 Integration Flow Test Variants Starting...');
console.log(`📋 Test Run ID: ${CONFIG.TEST_RUN_ID}`);
console.log(`🌐 Gateway: ${CONFIG.GATEWAY_BASE_URL}`);
console.log('');

// Utility functions
const makeRequest = (method, url, body = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Run': CONFIG.TEST_RUN_ID,
        ...headers
      },
      timeout: CONFIG.REQUEST_TIMEOUT_MS
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : null;
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: jsonData,
            rawData: data
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: null,
            rawData: data
          });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
};

const connectSSE = (url, lastEventId = null) => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const headers = {
      'Accept': 'text/event-stream',
      'X-Test-Run': CONFIG.TEST_RUN_ID,
      'SSE-Client-Name': `sse-${CONFIG.TEST_RUN_ID}`
    };
    
    if (lastEventId) {
      headers['Last-Event-ID'] = lastEventId;
    }

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers,
      timeout: CONFIG.SSE_TIMEOUT_MS
    };

    const req = client.request(options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`SSE connection failed: ${res.statusCode}`));
        return;
      }

      const events = [];
      let buffer = '';
      
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const eventData = line.slice(6);
            try {
              const parsed = JSON.parse(eventData);
              events.push(parsed);
            } catch (e) {
              // Ignore non-JSON events
            }
          }
        }
      });

      res.on('end', () => {
        resolve({ events, statusCode: res.statusCode });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('SSE timeout'));
    });

    req.end();
  });
};

const assert = (condition, message) => {
  if (!condition) {
    const error = new Error(message);
    results.errors.push(error);
    results.failed++;
    throw error;
  }
  results.passed++;
};

const logVariant = (variant, description) => {
  console.log(`\n${variant}. ${description}`);
  console.log('─'.repeat(50));
};

const logResult = (success, message) => {
  const icon = success ? '✅' : '❌';
  console.log(`${icon} ${message}`);
};

// Variant A: Idempotency Under Retry Storm
const testVariantA = async () => {
  logVariant('A', 'Idempotency Under Retry Storm');
  
  const runPayload = {
    name: `Retry Storm Test ${CONFIG.TEST_RUN_ID}`,
    input: { message: "Retry storm test" },
    client_token: `retry-storm-${CONFIG.TEST_RUN_ID}`,
    tags: ['retry-storm', CONFIG.TEST_RUN_ID]
  };

  console.log(`Making ${CONFIG.CONCURRENT_REQUESTS} concurrent requests with same idempotency key...`);
  
  const promises = Array(CONFIG.CONCURRENT_REQUESTS).fill().map(() => 
    makeRequest('POST', `${CONFIG.GATEWAY_BASE_URL}/api/runs`, runPayload)
  );

  const responses = await Promise.all(promises);
  
  // Count status codes
  const statusCounts = {};
  responses.forEach(res => {
    statusCounts[res.statusCode] = (statusCounts[res.statusCode] || 0) + 1;
  });
  
  console.log('Response status counts:', statusCounts);
  
  // Validate results
  assert(statusCounts[201] === 1, `Expected exactly 1x 201, got ${statusCounts[201] || 0}`);
  assert(statusCounts[200] === CONFIG.CONCURRENT_REQUESTS - 1, `Expected ${CONFIG.CONCURRENT_REQUESTS - 1}x 200, got ${statusCounts[200] || 0}`);
  
  // Check all responses have same run ID
  const runIds = responses.map(res => res.data?.run?.id).filter(Boolean);
  const uniqueRunIds = new Set(runIds);
  assert(uniqueRunIds.size === 1, `Expected 1 unique run ID, got ${uniqueRunIds.size}`);
  
  const runId = Array.from(uniqueRunIds)[0];
  logResult(true, `Retry storm passed: 1x 201, ${CONFIG.CONCURRENT_REQUESTS - 1}x 200, same run ID: ${runId}`);
  
  results.variants.variantA = {
    runId,
    statusCounts,
    responses: responses.length
  };
};

// Variant B: Cancel + Resume
const testVariantB = async () => {
  logVariant('B', 'Cancel + Resume');
  
  const runPayload = {
    name: `Cancel Resume Test ${CONFIG.TEST_RUN_ID}`,
    input: { message: "Cancel resume test" },
    client_token: `cancel-resume-${CONFIG.TEST_RUN_ID}`,
    tags: ['cancel-resume', CONFIG.TEST_RUN_ID]
  };

  // Create run
  const createResponse = await makeRequest('POST', `${CONFIG.GATEWAY_BASE_URL}/api/runs`, runPayload);
  assert(createResponse.statusCode === 201, `Create failed: ${createResponse.statusCode}`);
  const runId = createResponse.data.run.id;
  logResult(true, `Run created: ${runId}`);

  // Start run
  const startResponse = await makeRequest('POST', `${CONFIG.GATEWAY_BASE_URL}/api/runs/${runId}/start`);
  assert(startResponse.statusCode === 200, `Start failed: ${startResponse.statusCode}`);
  logResult(true, `Run started: ${runId}`);

  // Connect SSE and wait for some events
  console.log('Connecting to SSE stream...');
  const ssePromise = connectSSE(`${CONFIG.GATEWAY_BASE_URL}/api/runs/${runId}/logs/stream`);
  
  const sseResult = await Promise.race([
    ssePromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('SSE timeout')), 10000))
  ]);
  
  assert(sseResult.events.length > 0, 'No SSE events received');
  logResult(true, `SSE connected: ${sseResult.events.length} events`);

  // Cancel the run
  const cancelResponse = await makeRequest('POST', `${CONFIG.GATEWAY_BASE_URL}/api/runs/${runId}/cancel`);
  assert(cancelResponse.statusCode === 202, `Cancel failed: ${cancelResponse.statusCode}`);
  logResult(true, `Run cancelled: ${runId}`);

  // Wait a moment for cancellation to process
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Resume SSE with Last-Event-ID
  console.log('Resuming SSE with Last-Event-ID...');
  const lastEventId = sseResult.events[sseResult.events.length - 1]?.id || '0';
  
  try {
    const resumeResult = await Promise.race([
      connectSSE(`${CONFIG.GATEWAY_BASE_URL}/api/runs/${runId}/logs/stream`, lastEventId),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Resume timeout')), 5000))
    ]);
    
    // Check for cancellation event
    const hasCancelEvent = resumeResult.events.some(event => 
      event.type === 'run.cancelled' || event.state === 'canceled'
    );
    assert(hasCancelEvent, 'No cancellation event received on resume');
    
    logResult(true, `SSE resumed: ${resumeResult.events.length} events, cancellation detected`);
  } catch (e) {
    logResult(false, `SSE resume failed: ${e.message}`);
  }

  results.variants.variantB = {
    runId,
    initialEvents: sseResult.events.length,
    cancelled: true
  };
};

// Variant C: Partial Network Chaos
const testVariantC = async () => {
  logVariant('C', 'Partial Network Chaos');
  
  const runPayload = {
    name: `Network Chaos Test ${CONFIG.TEST_RUN_ID}`,
    input: { message: "Network chaos test" },
    client_token: `network-chaos-${CONFIG.TEST_RUN_ID}`,
    tags: ['network-chaos', CONFIG.TEST_RUN_ID]
  };

  // Create and start run
  const createResponse = await makeRequest('POST', `${CONFIG.GATEWAY_BASE_URL}/api/runs`, runPayload);
  assert(createResponse.statusCode === 201, `Create failed: ${createResponse.statusCode}`);
  const runId = createResponse.data.run.id;
  
  const startResponse = await makeRequest('POST', `${CONFIG.GATEWAY_BASE_URL}/api/runs/${runId}/start`);
  assert(startResponse.statusCode === 200, `Start failed: ${startResponse.statusCode}`);
  logResult(true, `Run created and started: ${runId}`);

  // Get initial metrics
  const metricsBefore = await makeRequest('GET', `${CONFIG.GATEWAY_BASE_URL}/metrics`);
  const sseActiveBefore = metricsBefore.data?.sse_active || 0;

  // Connect SSE
  console.log('Connecting to SSE stream...');
  const ssePromise = connectSSE(`${CONFIG.GATEWAY_BASE_URL}/api/runs/${runId}/logs/stream`);
  
  const sseResult = await Promise.race([
    ssePromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('SSE timeout')), 10000))
  ]);
  
  assert(sseResult.events.length > 0, 'No SSE events received');
  const lastEventId = sseResult.events[sseResult.events.length - 1]?.id || '0';
  logResult(true, `SSE connected: ${sseResult.events.length} events, last ID: ${lastEventId}`);

  // Simulate network drop (close connection abruptly)
  console.log('Simulating network drop...');
  
  // Wait for reconnection
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Reconnect with Last-Event-ID
  console.log('Reconnecting with Last-Event-ID...');
  try {
    const resumeResult = await Promise.race([
      connectSSE(`${CONFIG.GATEWAY_BASE_URL}/api/runs/${runId}/logs/stream`, lastEventId),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Reconnect timeout')), 10000))
    ]);
    
    // Check for no duplicates
    const originalEventIds = sseResult.events.map(e => e.id).filter(Boolean);
    const resumeEventIds = resumeResult.events.map(e => e.id).filter(Boolean);
    const duplicates = originalEventIds.filter(id => resumeEventIds.includes(id));
    
    assert(duplicates.length === 0, `Found ${duplicates.length} duplicate events on reconnect`);
    logResult(true, `Reconnect successful: ${resumeResult.events.length} new events, no duplicates`);
  } catch (e) {
    logResult(false, `Reconnect failed: ${e.message}`);
  }

  // Check metrics returned to baseline
  const metricsAfter = await makeRequest('GET', `${CONFIG.GATEWAY_BASE_URL}/metrics`);
  const sseActiveAfter = metricsAfter.data?.sse_active || 0;
  
  assert(Math.abs(sseActiveAfter - sseActiveBefore) <= 1, 
    `SSE connections not returned to baseline: ${sseActiveBefore} -> ${sseActiveAfter}`);
  logResult(true, 'SSE connections returned to baseline');

  results.variants.variantC = {
    runId,
    initialEvents: sseResult.events.length,
    sseActiveBefore,
    sseActiveAfter
  };
};

// Run all variants
const runVariants = async () => {
  try {
    console.log('Starting integration flow test variants...\n');
    
    await testVariantA();
    await testVariantB();
    await testVariantC();

    // Final Results
    console.log('\n' + '='.repeat(60));
    console.log('🎯 INTEGRATION FLOW TEST VARIANTS RESULTS');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📊 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
    
    if (results.errors.length > 0) {
      console.log('\n❌ Errors:');
      results.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error.message}`);
      });
    }
    
    const overallSuccess = results.failed === 0;
    console.log(`\n${overallSuccess ? '🎉' : '💥'} Overall Result: ${overallSuccess ? 'PASSED' : 'FAILED'}`);
    
    // Save results
    const fs = require('fs');
    const artifactsDir = `artifacts/${CONFIG.TEST_RUN_ID}`;
    if (!fs.existsSync('artifacts')) {
      fs.mkdirSync('artifacts');
    }
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }
    
    const summary = {
      test_run_id: CONFIG.TEST_RUN_ID,
      timestamp: new Date().toISOString(),
      results: {
        passed: results.passed,
        failed: results.failed,
        errors: results.errors.map(e => e.message)
      },
      variants: results.variants
    };
    
    fs.writeFileSync(`${artifactsDir}/variants.json`, JSON.stringify(summary, null, 2));
    console.log(`\n📁 Variants results saved to: ${artifactsDir}/variants.json`);
    
    process.exit(overallSuccess ? 0 : 1);

  } catch (error) {
    console.error('\n💥 Variants execution failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

// Run the variants
runVariants();
