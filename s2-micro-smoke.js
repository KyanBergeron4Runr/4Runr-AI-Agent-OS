#!/usr/bin/env node

/**
 * S2 — Micro Smoke Test (60 Seconds)
 * 
 * Purpose: Quick verification that authentication and basic functionality work
 * 
 * Timeline: 60 seconds
 * Workloads: Minimal SSE and runs
 * Expected: Both runs succeed; 0-1 SSE reconnects; no availability errors
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  GATEWAY_URL: 'http://localhost:3000',
  TEST_DURATION: 60 * 1000, // 60 seconds
  WORKSPACE_ID: 's2-micro',
  TEST_TOKEN: 'test-token-s2-harness',
  TEST_BYPASS: true,
  
  // Minimal workload
  SSE_CLIENT_COUNT: 4,
  RUN_COUNT: 2
};

// ============================================================================
// TEST STATE
// ============================================================================

const TEST_STATE = {
  startTime: Date.now(),
  metrics: {
    runsStarted: 0,
    runsSuccessful: 0,
    runsFailed: 0,
    sseActive: 0,
    sseReconnects: 0,
    availabilityChecks: 0,
    availabilityFailures: 0
  },
  sseClients: new Map()
};

// ============================================================================
// UTILITIES
// ============================================================================

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

function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, CONFIG.GATEWAY_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        ...getAuthHeaders(),
        ...headers
      }
    };

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
          resolve(response);
        } catch (error) {
          resolve({ 
            status: res.statusCode, 
            headers: res.headers, 
            data: body,
            body: body 
          });
        }
      });
    });

    req.on('error', (error) => {
      console.log(`🌐 Request error (${method} ${path}): ${error.message}`);
      reject(error);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function setupWorkspacePlan() {
  try {
    console.log('🔧 Setting up workspace plan...');
    const response = await makeRequest('POST', '/api/workspace/plan', { plan: 'pro' });
    
    if (response.status !== 200) {
      console.log(`❌ Failed to set workspace plan: ${response.status} - ${JSON.stringify(response.data)}`);
      return false;
    }
    
    console.log('✅ Workspace plan set to pro');
    return true;
  } catch (error) {
    console.log(`❌ Error setting workspace plan: ${error.message}`);
    return false;
  }
}

// ============================================================================
// SSE CLIENT
// ============================================================================

class EventSourceLike {
  constructor(clientId, url) {
    this.clientId = clientId;
    this.url = url;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    
    this.connect();
  }
  
  connect() {
    try {
      const url = new URL(this.url, CONFIG.GATEWAY_URL);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers: {
          ...getAuthHeaders(),
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        }
      };
      
      const req = http.request(options, (res) => {
        if (res.statusCode === 200) {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          TEST_STATE.metrics.sseActive++;
          console.log(`🔌 SSE ${this.clientId} connected`);
          
          res.on('end', () => {
            this.isConnected = false;
            TEST_STATE.metrics.sseActive--;
            this.scheduleReconnect();
          });
          
          res.on('error', (error) => {
            console.log(`🔌 SSE ${this.clientId} connection error: ${error.message}`);
            this.isConnected = false;
            TEST_STATE.metrics.sseActive--;
            this.scheduleReconnect();
          });
        } else {
          let errorBody = '';
          res.on('data', chunk => errorBody += chunk);
          res.on('end', () => {
            console.log(`🔌 SSE ${this.clientId} request error: ${res.statusCode} - ${errorBody.substring(0, 200)}`);
            this.scheduleReconnect();
          });
        }
      });
      
      req.on('error', (error) => {
        console.log(`🔌 SSE ${this.clientId} request error: ${error.message}`);
        this.scheduleReconnect();
      });
      
      req.end();
    } catch (error) {
      console.log(`🔌 SSE ${this.clientId} connection setup error: ${error.message}`);
      this.scheduleReconnect();
    }
  }
  
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log(`🔌 SSE ${this.clientId} max reconnects reached`);
      return;
    }
    
    this.reconnectAttempts++;
    TEST_STATE.metrics.sseReconnects++;
    
    const delay = 2000 + Math.random() * 1000;
    setTimeout(() => {
      this.connect();
    }, delay);
  }
  
  disconnect() {
    this.isConnected = false;
    TEST_STATE.metrics.sseActive--;
  }
}

// ============================================================================
// WORKLOADS
// ============================================================================

async function createRun(runId) {
  try {
    TEST_STATE.metrics.runsStarted++;
    
    // Create run
    const createResponse = await makeRequest('POST', '/api/runs', {
      id: runId,
      name: `Micro-Run-${runId.substring(0, 8)}`,
      workspace_id: CONFIG.WORKSPACE_ID
    });
    
    if (createResponse.status !== 201) {
      console.log(`❌ Run ${runId} failed: ${createResponse.status} - ${JSON.stringify(createResponse.data)}`);
      TEST_STATE.metrics.runsFailed++;
      return false;
    }
    
    // Start run
    const startResponse = await makeRequest('POST', `/api/runs/${runId}/start`);
    if (startResponse.status !== 200) {
      console.log(`❌ Run ${runId} start failed: ${startResponse.status} - ${JSON.stringify(startResponse.data)}`);
      TEST_STATE.metrics.runsFailed++;
      return false;
    }
    
    // Wait for completion
    const startTime = Date.now();
    const timeout = 30000; // 30 seconds
    
    while (Date.now() - startTime < timeout) {
      const statusResponse = await makeRequest('GET', `/api/runs/${runId}`);
      if (statusResponse.status !== 200) {
        console.log(`❌ Run ${runId} status check failed: ${statusResponse.status}`);
        TEST_STATE.metrics.runsFailed++;
        return false;
      }
      
      if (statusResponse.data.status === 'completed' || statusResponse.data.status === 'failed') {
        if (statusResponse.data.status === 'completed') {
          console.log(`✅ Run ${runId} completed successfully`);
          TEST_STATE.metrics.runsSuccessful++;
          return true;
        } else {
          console.log(`❌ Run ${runId} failed`);
          TEST_STATE.metrics.runsFailed++;
          return false;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`⏰ Run ${runId} timed out after 30s`);
    TEST_STATE.metrics.runsFailed++;
    return false;
    
  } catch (error) {
    console.log(`❌ Run creation error: ${error.message}`);
    TEST_STATE.metrics.runsFailed++;
    return false;
  }
}

async function setupSSEClients() {
  console.log(`🔌 Setting up ${CONFIG.SSE_CLIENT_COUNT} SSE clients...`);
  
  for (let i = 0; i < CONFIG.SSE_CLIENT_COUNT; i++) {
    const clientId = `sse-${i}`;
    const client = new EventSourceLike(clientId, '/api/runs/logs/stream');
    TEST_STATE.sseClients.set(clientId, client);
  }
}

async function checkAvailability() {
  try {
    TEST_STATE.metrics.availabilityChecks++;
    const response = await makeRequest('GET', '/health');
    
    if (response.status !== 200) {
      console.log(`❌ Availability check error: ${response.status} - ${JSON.stringify(response.data)}`);
      TEST_STATE.metrics.availabilityFailures++;
      return false;
    }
    
    return true;
  } catch (error) {
    console.log(`❌ Availability check error: ${error.message}`);
    TEST_STATE.metrics.availabilityFailures++;
    return false;
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function runMicroSmoke() {
  console.log('🚀 Starting S2 — Micro Smoke Test (60 Seconds)');
  console.log('========================================');
  
  try {
    // Setup workspace plan first
    const planSetup = await setupWorkspacePlan();
    if (!planSetup) {
      console.log('❌ Failed to setup workspace plan - aborting test');
      process.exit(1);
    }
    
    // Setup SSE clients
    await setupSSEClients();
    
    // Wait a moment for SSE connections
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Create runs
    console.log(`🏃 Creating ${CONFIG.RUN_COUNT} runs...`);
    const runPromises = [];
    for (let i = 0; i < CONFIG.RUN_COUNT; i++) {
      const runId = crypto.randomUUID();
      runPromises.push(createRun(runId));
    }
    
    // Wait for runs to complete
    await Promise.all(runPromises);
    
    // Check availability
    console.log('🔍 Checking availability...');
    await checkAvailability();
    
    // Wait for test duration
    const elapsed = Date.now() - TEST_STATE.startTime;
    const remaining = Math.max(0, CONFIG.TEST_DURATION - elapsed);
    if (remaining > 0) {
      console.log(`⏳ Waiting ${Math.round(remaining / 1000)}s for test completion...`);
      await new Promise(resolve => setTimeout(resolve, remaining));
    }
    
    // Final availability check
    await checkAvailability();
    
    // Cleanup SSE clients
    TEST_STATE.sseClients.forEach(client => client.disconnect());
    
    // Results
    const successRate = TEST_STATE.metrics.runsStarted > 0 
      ? (TEST_STATE.metrics.runsSuccessful / TEST_STATE.metrics.runsStarted * 100).toFixed(1)
      : '0.0';
    const availability = TEST_STATE.metrics.availabilityChecks > 0
      ? ((TEST_STATE.metrics.availabilityChecks - TEST_STATE.metrics.availabilityFailures) / TEST_STATE.metrics.availabilityChecks * 100).toFixed(1)
      : '0.0';
    
    console.log('\n📊 MICRO SMOKE TEST RESULTS');
    console.log('========================================');
    console.log(`📈 Total runs: ${TEST_STATE.metrics.runsStarted}`);
    console.log(`✅ Successful: ${TEST_STATE.metrics.runsSuccessful}`);
    console.log(`❌ Failed: ${TEST_STATE.metrics.runsFailed}`);
    console.log(`🔗 SSE connections: ${TEST_STATE.metrics.sseActive}`);
    console.log(`🔄 SSE reconnects: ${TEST_STATE.metrics.sseReconnects}`);
    console.log(`🔍 Availability checks: ${TEST_STATE.metrics.availabilityChecks}`);
    console.log(`❌ Availability failures: ${TEST_STATE.metrics.availabilityFailures}`);
    console.log(`📊 Success rate: ${successRate}%`);
    console.log(`📊 Availability: ${availability}%`);
    
    // Determine success
    const success = TEST_STATE.metrics.runsSuccessful >= 2 && 
                   TEST_STATE.metrics.availabilityFailures === 0 &&
                   TEST_STATE.metrics.sseReconnects <= 1;
    
    if (success) {
      console.log('\n🎉 Micro smoke test PASSED!');
      console.log('✅ Both runs succeeded');
      console.log('✅ No availability errors');
      console.log('✅ SSE reconnects within limit');
      console.log('\n🚀 Ready for full S2 smoke test!');
    } else {
      console.log('\n❌ Micro smoke test FAILED!');
      if (TEST_STATE.metrics.runsSuccessful < 2) {
        console.log('❌ Not all runs succeeded');
      }
      if (TEST_STATE.metrics.availabilityFailures > 0) {
        console.log('❌ Availability check failures');
      }
      if (TEST_STATE.metrics.sseReconnects > 1) {
        console.log('❌ Too many SSE reconnects');
      }
    }
    
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    console.error('💥 Fatal micro smoke error:', error);
    process.exit(1);
  }
}

// Run the micro smoke test
runMicroSmoke().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
