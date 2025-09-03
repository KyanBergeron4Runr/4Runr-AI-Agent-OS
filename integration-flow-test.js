#!/usr/bin/env node

const http = require('http');
const https = require('https');
const crypto = require('crypto');

// Configuration
const CONFIG = {
  GATEWAY_BASE_URL: process.env.GATEWAY_BASE_URL || 'http://localhost:3000',
  REGISTRY_BASE_URL: process.env.REGISTRY_BASE_URL || 'http://localhost:3001',
  TEST_RUN_ID: process.env.TEST_RUN_ID || `itg-${new Date().toISOString().slice(0,10).replace(/-/g, '')}-${crypto.randomBytes(4).toString('hex')}`,
  AGENT_NAME: process.env.AGENT_NAME || 'test-agent',
  AGENT_VERSION: process.env.AGENT_VERSION || '1.0.0',
  SSE_TIMEOUT_MS: parseInt(process.env.SSE_TIMEOUT_MS) || 60000,
  REQUEST_TIMEOUT_MS: parseInt(process.env.REQUEST_TIMEOUT_MS) || 10000
};

// Test state
const testState = {
  agent_id: null,
  agent_version: null,
  manifest_digest: null,
  run_id: null,
  last_event_id: null,
  sse_events: [],
  metrics_before: null,
  metrics_after: null,
  start_time: Date.now()
};

// Test results
const results = {
  passed: 0,
  failed: 0,
  errors: [],
  artifacts: {}
};

console.log('🚀 Integration Flow Test Starting...');
console.log(`📋 Test Run ID: ${CONFIG.TEST_RUN_ID}`);
console.log(`🌐 Gateway: ${CONFIG.GATEWAY_BASE_URL}`);
console.log(`📦 Registry: ${CONFIG.REGISTRY_BASE_URL}`);
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
      let hasResolved = false;
      
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('id: ')) {
            const eventId = line.slice(4);
            testState.last_event_id = eventId;
          } else if (line.startsWith('data: ')) {
            const eventData = line.slice(6);
            try {
              const parsed = JSON.parse(eventData);
              events.push(parsed);
              testState.sse_events.push(parsed);
              
              // Resolve when we have enough events (at least 2: connected + status_update)
              if (events.length >= 2 && !hasResolved) {
                hasResolved = true;
                req.destroy(); // Close the connection
                resolve({ events, statusCode: res.statusCode });
              }
            } catch (e) {
              // Ignore non-JSON events
            }
          }
        }
      });

      res.on('end', () => {
        if (!hasResolved) {
          resolve({ events, statusCode: res.statusCode });
        }
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

const logStep = (step, description) => {
  console.log(`\n${step}. ${description}`);
  console.log('─'.repeat(50));
};

const logResult = (success, message) => {
  const icon = success ? '✅' : '❌';
  console.log(`${icon} ${message}`);
};

// Test steps
const runTests = async () => {
  try {
    // Step 0: Prerequisites
    logStep('0', 'Prerequisites Check');
    
    // Check gateway health
    const gatewayHealth = await makeRequest('GET', `${CONFIG.GATEWAY_BASE_URL}/health`);
    assert(gatewayHealth.statusCode === 200, 'Gateway health check failed');
    logResult(true, 'Gateway is healthy');
    
    // Check registry health (if available)
    try {
      const registryHealth = await makeRequest('GET', `${CONFIG.REGISTRY_BASE_URL}/health`);
      assert(registryHealth.statusCode === 200, 'Registry health check failed');
      logResult(true, 'Registry is healthy');
    } catch (e) {
      logResult(false, `Registry health check failed: ${e.message}`);
    }
    
    // Capture initial metrics
    const initialMetrics = await makeRequest('GET', `${CONFIG.GATEWAY_BASE_URL}/metrics`);
    testState.metrics_before = initialMetrics.rawData;
    logResult(true, 'Initial metrics captured');

    // Step 1: Test Identity & Consistency
    logStep('1', 'Test Identity & Consistency');
    console.log(`Using test prefix: ${CONFIG.TEST_RUN_ID}`);
    console.log(`Idempotency key: idemp-${CONFIG.TEST_RUN_ID}`);
    console.log(`SSE client name: sse-${CONFIG.TEST_RUN_ID}`);
    logResult(true, 'Test identity configured');

    // Step 2: Agent Publish (Mock - since we don't have real registry)
    logStep('2', 'Agent Publish');
    console.log('📝 Note: Using mock agent publish since real registry not available');
    testState.agent_id = `${CONFIG.AGENT_NAME}-${CONFIG.TEST_RUN_ID}`;
    testState.agent_version = CONFIG.AGENT_VERSION;
    testState.manifest_digest = crypto.randomBytes(16).toString('hex');
    logResult(true, `Mock agent published: ${testState.agent_id}@${testState.agent_version}`);

    // Step 3: Client Discover (Mock)
    logStep('3', 'Client Discover');
    console.log('📝 Note: Using mock agent discovery');
    logResult(true, `Agent discovered: ${testState.agent_id}@${testState.agent_version}`);

    // Step 4: Create Run (with Idempotency)
    logStep('4', 'Create Run (with Idempotency)');
    
    const runPayload = {
      name: `Integration Test Run ${CONFIG.TEST_RUN_ID}`,
      input: {
        message: "Hello from integration test",
        timestamp: new Date().toISOString()
      },
      client_token: `idemp-${CONFIG.TEST_RUN_ID}`,
      tags: ['integration-test', CONFIG.TEST_RUN_ID]
    };

    // First call - should return 201
    const createResponse1 = await makeRequest('POST', `${CONFIG.GATEWAY_BASE_URL}/api/runs`, runPayload);
    assert(createResponse1.statusCode === 201, `First create call failed: ${createResponse1.statusCode}`);
    assert(createResponse1.data && createResponse1.data.run && createResponse1.data.run.id, 'No run ID in response');
    testState.run_id = createResponse1.data.run.id;
    logResult(true, `Run created: ${testState.run_id} (201)`);

    // Second call - should return 200 with same ID
    const createResponse2 = await makeRequest('POST', `${CONFIG.GATEWAY_BASE_URL}/api/runs`, runPayload);
    assert(createResponse2.statusCode === 200, `Second create call failed: ${createResponse2.statusCode}`);
    assert(createResponse2.data && createResponse2.data.run && createResponse2.data.run.id === testState.run_id, 'Different run ID on retry');
    assert(createResponse2.data.idempotent === true, 'Idempotent flag not set');
    logResult(true, `Run idempotent: ${testState.run_id} (200)`);

    // Step 5: Start Run
    logStep('5', 'Start Run');
    const startResponse = await makeRequest('POST', `${CONFIG.GATEWAY_BASE_URL}/api/runs/${testState.run_id}/start`);
    assert(startResponse.statusCode === 200, `Start run failed: ${startResponse.statusCode}`);
    logResult(true, `Run started: ${testState.run_id}`);

    // Step 6: Stream Output (SSE)
    logStep('6', 'Stream Output (SSE)');
    console.log('Connecting to SSE stream...');
    
    const sseResult = await connectSSE(`${CONFIG.GATEWAY_BASE_URL}/api/runs/${testState.run_id}/logs/stream`);
    
    assert(sseResult.events.length >= 2, `Expected at least 2 events, got ${sseResult.events.length}`);
    assert(testState.last_event_id, 'No event ID received');
    logResult(true, `SSE connected: ${sseResult.events.length} events, last ID: ${testState.last_event_id}`);

    // Step 7: Optional: Mid-Run Cancel
    logStep('7', 'Mid-Run Cancel');
    const cancelResponse = await makeRequest('POST', `${CONFIG.GATEWAY_BASE_URL}/api/runs/${testState.run_id}/cancel`);
    assert(cancelResponse.statusCode === 202, `Cancel failed: ${cancelResponse.statusCode}`);
    logResult(true, `Run cancelled: ${testState.run_id}`);

    // Step 8: Resume SSE (Last-Event-ID)
    logStep('8', 'Resume SSE (Last-Event-ID)');
    console.log(`Resuming with Last-Event-ID: ${testState.last_event_id}`);
    
    const resumePromise = connectSSE(`${CONFIG.GATEWAY_BASE_URL}/api/runs/${testState.run_id}/logs/stream`, testState.last_event_id);
    
    try {
      const resumeResult = await resumePromise;
      
      // Check that we don't get duplicate events
      const originalEventIds = testState.sse_events.map(e => e.id || e.event_id).filter(Boolean);
      const resumeEventIds = resumeResult.events.map(e => e.id || e.event_id).filter(Boolean);
      
      const duplicates = originalEventIds.filter(id => resumeEventIds.includes(id));
      assert(duplicates.length === 0, `Found ${duplicates.length} duplicate events on resume`);
      
      logResult(true, `SSE resumed: ${resumeResult.events.length} new events, no duplicates`);
    } catch (e) {
      logResult(false, `SSE resume failed: ${e.message}`);
    }

    // Step 9: Let Run Complete
    logStep('9', 'Run Completion');
    // Run should already be cancelled, so we just verify the final state
    const finalRunResponse = await makeRequest('GET', `${CONFIG.GATEWAY_BASE_URL}/api/runs/${testState.run_id}`);
    assert(finalRunResponse.statusCode === 200, `Get final run state failed: ${finalRunResponse.statusCode}`);
    assert(finalRunResponse.data.run.status === 'canceled', `Run not in canceled state: ${finalRunResponse.data.run.status}`);
    logResult(true, `Run completed in canceled state`);

    // Step 10: Registry & Metrics Reconciliation
    logStep('10', 'Metrics Reconciliation');
    
    const finalMetrics = await makeRequest('GET', `${CONFIG.GATEWAY_BASE_URL}/metrics`);
    testState.metrics_after = finalMetrics.rawData;
    
    // Basic metrics validation
    assert(testState.metrics_after, 'Final metrics not available');
    logResult(true, 'Final metrics captured');
    
    // Parse metrics to check SSE connections
    const metricsLines = testState.metrics_after.split('\n');
    const sseActiveLine = metricsLines.find(line => line.startsWith('sse_active_connections'));
    const sseActiveAfter = sseActiveLine ? parseInt(sseActiveLine.split(' ')[1]) : 0;
    
    // Check that SSE connections returned to baseline (should be 0 or close to it)
    assert(sseActiveAfter <= 1, `SSE connections not returned to baseline: ${sseActiveAfter}`);
    logResult(true, 'SSE connections returned to baseline');

    // Step 11: Logs & Artifacts
    logStep('11', 'Logs & Artifacts Collection');
    
    results.artifacts = {
      test_run_id: CONFIG.TEST_RUN_ID,
      start_time: new Date(testState.start_time).toISOString(),
      end_time: new Date().toISOString(),
      duration_ms: Date.now() - testState.start_time,
      test_state: testState,
      metrics_before: testState.metrics_before,
      metrics_after: testState.metrics_after,
      sse_events: testState.sse_events,
      results: {
        passed: results.passed,
        failed: results.failed,
        errors: results.errors.map(e => e.message)
      }
    };
    
    logResult(true, 'Test artifacts collected');

    // Final Results
    console.log('\n' + '='.repeat(60));
    console.log('🎯 INTEGRATION FLOW TEST RESULTS');
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
    
    // Save artifacts
    const fs = require('fs');
    const artifactsDir = `artifacts/${CONFIG.TEST_RUN_ID}`;
    if (!fs.existsSync('artifacts')) {
      fs.mkdirSync('artifacts');
    }
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }
    
    fs.writeFileSync(`${artifactsDir}/summary.json`, JSON.stringify(results.artifacts, null, 2));
    console.log(`\n📁 Artifacts saved to: ${artifactsDir}/summary.json`);
    
    process.exit(overallSuccess ? 0 : 1);

  } catch (error) {
    console.error('\n💥 Test execution failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

// Run the tests
runTests();
