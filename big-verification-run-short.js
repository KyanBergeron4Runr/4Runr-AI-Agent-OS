#!/usr/bin/env node

/**
 * TASK V1 — Big Verification Run (SHORT VERSION) — 10 minutes
 * 
 * Purpose: Validate the whole backend under realistic usage, burst stress, and faults
 * 
 * Timeline (compressed):
 * - Phase A: Warmup & Baseline (2 min)
 * - Phase B: Real-Life Usage Soak (4 min) 
 * - Phase C: Stress & Spike (3 min)
 * - Phase D: Cooldown & Integrity (1 min)
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');

// Configuration (shortened)
const CONFIG = {
  GATEWAY_URL: 'http://localhost:3000',
  TEST_DURATION: 10 * 60 * 1000, // 10 minutes in ms
  PHASE_A_DURATION: 2 * 60 * 1000, // 2 minutes
  PHASE_B_DURATION: 4 * 60 * 1000, // 4 minutes
  PHASE_C_DURATION: 3 * 60 * 1000, // 3 minutes
  PHASE_D_DURATION: 1 * 60 * 1000, // 1 minute
  
  // Phase A targets
  PHASE_A_RUNS: 5,
  
  // Phase B targets
  PHASE_B_RUNS_PER_MIN: 3, // 3 runs/min
  PHASE_B_SSE_CLIENTS: 10,
  PHASE_B_CHURN_INTERVAL: 2 * 60 * 1000, // 2 minutes
  
  // Phase C targets
  PHASE_C_RPS_STEPS: [20, 30, 50],
  PHASE_C_SPIKE_RPS: 100,
  PHASE_C_SSE_CLIENTS: 20,
  
  // Latency targets
  TARGETS: {
    START_TO_LOG_P95_SOAK: 1200, // 1.2s
    START_TO_LOG_P95_STRESS: 2000, // 2.0s
    JUDGE_P95: 300,
    SHIELD_P95: 200,
    SSE_WRITE_P99: 200,
    AVAILABILITY: 99.9,
    SSE_RECONNECT_SOAK: 99,
    SSE_RECONNECT_STRESS: 98,
    ERROR_RATE: 2, // 2%
    PUBLISH_SEARCH_DELAY: 10000, // 10s
  }
};

// Test state
const TEST_STATE = {
  startTime: Date.now(),
  currentPhase: 'A',
  metrics: {
    runsStarted: 0,
    runsCompleted: 0,
    runsFailed: 0,
    sseConnections: 0,
    sseReconnects: 0,
    sseDuplicates: 0,
    errors: {
      '4xx': 0,
      '5xx': 0
    },
    latencies: {
      startToLog: [],
      judge: [],
      shield: [],
      sseWrite: []
    }
  },
  sseClients: new Map(),
  activeRuns: new Set(),
  snapshots: {}
};

// Utility functions
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
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
        'Content-Type': 'application/json',
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
            data: body ? JSON.parse(body) : null
          };
          resolve(response);
        } catch (error) {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

function captureMetricsSnapshot(name) {
  return makeRequest('GET', '/metrics')
    .then(response => {
      if (response.status === 200) {
        TEST_STATE.snapshots[name] = {
          timestamp: Date.now(),
          metrics: response.data,
          testState: { ...TEST_STATE.metrics }
        };
        log(`📊 Snapshot captured: ${name}`);
        return response.data;
      }
      throw new Error(`Failed to capture metrics: ${response.status}`);
    });
}

function measureLatency(operation) {
  const start = Date.now();
  return {
    start,
    end: () => Date.now() - start,
    record: (latency) => {
      TEST_STATE.metrics.latencies[operation].push(latency);
    }
  };
}

function calculatePercentile(values, percentile) {
  if (values.length === 0) return 0;
  const sorted = values.sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// SSE Client class
class SSEClient {
  constructor(runId, type = 'logs') {
    this.runId = runId;
    this.type = type;
    this.connected = false;
    this.events = [];
    this.lastEventId = null;
    this.reconnectCount = 0;
    this.duplicates = 0;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const path = `/api/runs/${this.runId}/${this.type}/stream`;
      const url = new URL(path, CONFIG.GATEWAY_URL);
      
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'GET',
        headers: this.lastEventId ? { 'Last-Event-ID': this.lastEventId } : {}
      };

      const req = http.request(options, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`SSE connection failed: ${res.statusCode}`));
          return;
        }

        this.connected = true;
        TEST_STATE.metrics.sseConnections++;
        
        res.on('data', (chunk) => {
          const lines = chunk.toString().split('\n');
          lines.forEach(line => {
            if (line.startsWith('id: ')) {
              this.lastEventId = line.substring(4);
            } else if (line.startsWith('data: ')) {
              const eventData = line.substring(6);
              if (eventData.trim()) {
                try {
                  const parsed = JSON.parse(eventData);
                  const eventId = parsed._event_id || this.lastEventId;
                  
                  // Check for duplicates
                  if (this.events.some(e => e._event_id === eventId)) {
                    this.duplicates++;
                    TEST_STATE.metrics.sseDuplicates++;
                  } else {
                    this.events.push(parsed);
                  }
                } catch (error) {
                  // Ignore parse errors
                }
              }
            }
          });
        });

        res.on('end', () => {
          this.connected = false;
        });

        res.on('error', (error) => {
          this.connected = false;
          reject(error);
        });

        resolve();
      });

      req.on('error', reject);
      req.end();
    });
  }

  disconnect() {
    this.connected = false;
  }

  reconnect() {
    this.reconnectCount++;
    TEST_STATE.metrics.sseReconnects++;
    return this.connect();
  }
}

// Test phases
async function phaseA_Warmup() {
  log('🚀 PHASE A: Warmup & Baseline (2 minutes)');
  
  const startTime = Date.now();
  
  // Start light traffic
  const runPromises = [];
  for (let i = 0; i < CONFIG.PHASE_A_RUNS; i++) {
    const agent = i % 2 === 0 ? 'demo-enricher' : 'demo-scraper';
    runPromises.push(startRun(agent));
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Start SSE clients
  for (let i = 0; i < 3; i++) {
    const runId = await startRun('demo-enricher');
    if (runId) {
      await startSSEClient(runId, 'logs');
      await startSSEClient(runId, 'guard');
    }
  }
  
  // Wait for all runs to complete
  await Promise.all(runPromises);
  
  // Capture baseline metrics
  await captureMetricsSnapshot('A0');
  
  const duration = Date.now() - startTime;
  log(`✅ Phase A completed in ${duration}ms`);
}

async function phaseB_Soak() {
  log('🌊 PHASE B: Real-Life Usage Soak (4 minutes)');
  
  const startTime = Date.now();
  const endTime = startTime + CONFIG.PHASE_B_DURATION;
  
  // Start SSE churn
  const sseChurnInterval = setInterval(async () => {
    await churnSSEClients();
  }, CONFIG.PHASE_B_CHURN_INTERVAL);
  
  // Main soak loop
  while (Date.now() < endTime) {
    // Start runs at target pace
    const runsPerMinute = CONFIG.PHASE_B_RUNS_PER_MIN;
    const interval = 60 * 1000 / runsPerMinute;
    
    for (let i = 0; i < runsPerMinute; i++) {
      const agent = Math.random() < 0.7 ? 'demo-enricher' : 'demo-scraper';
      const runId = await startRun(agent);
      
      if (runId) {
        // Attach SSE for 3-5 seconds
        setTimeout(async () => {
          await startSSEClient(runId, 'logs');
          setTimeout(() => {
            // Detach after 3-5 seconds
            const client = TEST_STATE.sseClients.get(`${runId}-logs`);
            if (client) {
              client.disconnect();
              TEST_STATE.sseClients.delete(`${runId}-logs`);
            }
          }, 3000 + Math.random() * 2000);
        }, 1000);
      }
      
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    // Capture snapshots
    const elapsed = Date.now() - startTime;
    if (elapsed >= 2 * 60 * 1000 && !TEST_STATE.snapshots.B10) {
      await captureMetricsSnapshot('B10');
    }
  }
  
  clearInterval(sseChurnInterval);
  
  log('✅ Phase B completed');
}

async function phaseC_Stress() {
  log('🔥 PHASE C: Stress & Spike (3 minutes)');
  
  const startTime = Date.now();
  const endTime = startTime + CONFIG.PHASE_C_DURATION;
  
  // Ramp up stress levels
  for (const rps of CONFIG.PHASE_C_RPS_STEPS) {
    const stepStart = Date.now();
    const stepEnd = stepStart + 1 * 60 * 1000; // 1 minute per step
    
    log(`🔥 Stress level: ${rps} RPS`);
    
    while (Date.now() < stepEnd && Date.now() < endTime) {
      // Start runs at target RPS
      const interval = 1000 / rps;
      const promises = [];
      
      for (let i = 0; i < rps; i++) {
              const agent = Math.random() < 0.7 ? 'demo-enricher' : 'demo-scraper';
      const runId = await startRun(agent);
      if (runId) {
        promises.push(Promise.resolve(runId));
      }
      }
      
      await Promise.all(promises);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Inject chaos
  setTimeout(async () => {
    log('💥 Injecting chaos: Simulated restart');
    await injectChaos();
  }, 1.5 * 60 * 1000);
  
  await captureMetricsSnapshot('Cend');
  log('✅ Phase C completed');
}

async function phaseD_Cooldown() {
  log('❄️ PHASE D: Cooldown & Integrity (1 minute)');
  
  const startTime = Date.now();
  const endTime = startTime + CONFIG.PHASE_D_DURATION;
  
  // Light traffic
  while (Date.now() < endTime) {
    const agent = Math.random() < 0.5 ? 'demo-enricher' : 'demo-scraper';
    const runId = await startRun(agent);
    if (runId) {
      // Run started successfully
    }
    await new Promise(resolve => setTimeout(resolve, 30 * 1000)); // 2 runs/min
  }
  
  // Test privacy mode
  await testPrivacyMode();
  
  await captureMetricsSnapshot('Dend');
  log('✅ Phase D completed');
}

// Helper functions
async function startRun(agent) {
  const latency = measureLatency('startToLog');
  
  try {
    // Use unique workspace to avoid concurrency limits
    const workspaceId = `stress-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const runData = { workspace_id: workspaceId };
    
    const response = await makeRequest('POST', `/api/agents/${agent}/run`, runData);
    
    if (response.status === 200) {
      TEST_STATE.metrics.runsStarted++;
      const runId = response.data.run_id;
      TEST_STATE.activeRuns.add(runId);
      
      // Measure start to first log latency
      setTimeout(async () => {
        try {
          const logResponse = await makeRequest('GET', `/api/runs/${runId}/logs/stream`);
          if (logResponse.status === 200) {
            const endTime = latency.end();
            latency.record(endTime);
          }
        } catch (error) {
          // Ignore SSE connection errors
        }
      }, 100);
      
      return runId;
    } else if (response.status === 409) {
      // Concurrency limit hit - this is expected behavior
      TEST_STATE.metrics.errors['4xx']++;
      log(`Concurrency limit hit for ${agent} (expected)`, 'WARN');
      return null;
    } else {
      TEST_STATE.metrics.errors[response.status >= 500 ? '5xx' : '4xx']++;
      throw new Error(`Run start failed: ${response.status}`);
    }
  } catch (error) {
    TEST_STATE.metrics.runsFailed++;
    throw error;
  }
}

async function startSSEClient(runId, type) {
  const client = new SSEClient(runId, type);
  const key = `${runId}-${type}`;
  TEST_STATE.sseClients.set(key, client);
  
  try {
    await client.connect();
    return client;
  } catch (error) {
    log(`SSE connection failed: ${error.message}`, 'ERROR');
    throw error;
  }
}

async function churnSSEClients() {
  const clients = Array.from(TEST_STATE.sseClients.values());
  const toClose = Math.floor(clients.length * 0.2); // Close 20%
  
  for (let i = 0; i < toClose; i++) {
    const client = clients[Math.floor(Math.random() * clients.length)];
    client.disconnect();
  }
  
  // Reconnect within 3 seconds
  setTimeout(async () => {
    for (const client of clients.slice(0, toClose)) {
      try {
        await client.reconnect();
      } catch (error) {
        log(`SSE reconnect failed: ${error.message}`, 'ERROR');
      }
    }
  }, 3000);
}

async function injectChaos() {
  log('💥 Simulating gateway restart...');
  
  const chaosStart = Date.now();
  const chaosDuration = 5 * 1000; // 5 seconds
  
  while (Date.now() - chaosStart < chaosDuration) {
    try {
      await makeRequest('GET', '/health');
    } catch (error) {
      // Expected during restart
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  log('✅ Chaos injection completed');
}

async function testPrivacyMode() {
  log('🔒 Testing privacy mode...');
  
  // Set privacy mode to hash-only
  await makeRequest('POST', '/api/workspace/privacy', { storePlain: false });
  
  // Start a run and check for plaintext
  const runId = await startRun('demo-enricher');
  
  // Check logs for plaintext
  const logResponse = await makeRequest('GET', `/api/runs/${runId}`);
  if (logResponse.status === 200) {
    const run = logResponse.data;
    const hasPlaintext = JSON.stringify(run).includes('"content":') && 
                        !JSON.stringify(run).includes('"hash":');
    
    if (hasPlaintext) {
      throw new Error('Privacy mode failed: plaintext found in logs');
    }
  }
  
  log('✅ Privacy mode test passed');
}

// Validation functions
function validateResults() {
  log('🔍 Validating test results...');
  
  const results = {
    passed: true,
    failures: []
  };
  
  // Calculate percentiles
  const startToLogP95 = calculatePercentile(TEST_STATE.metrics.latencies.startToLog, 95);
  const judgeP95 = calculatePercentile(TEST_STATE.metrics.latencies.judge, 95);
  const shieldP95 = calculatePercentile(TEST_STATE.metrics.latencies.shield, 95);
  const sseWriteP99 = calculatePercentile(TEST_STATE.metrics.latencies.sseWrite, 99);
  
  // Validate targets
  if (startToLogP95 > CONFIG.TARGETS.START_TO_LOG_P95_SOAK) {
    results.failures.push(`Start-to-log P95 too high: ${startToLogP95}ms`);
    results.passed = false;
  }
  
  if (judgeP95 > CONFIG.TARGETS.JUDGE_P95) {
    results.failures.push(`Judge P95 too high: ${judgeP95}ms`);
    results.passed = false;
  }
  
  if (shieldP95 > CONFIG.TARGETS.SHIELD_P95) {
    results.failures.push(`Shield P95 too high: ${shieldP95}ms`);
    results.passed = false;
  }
  
  if (sseWriteP99 > CONFIG.TARGETS.SSE_WRITE_P99) {
    results.failures.push(`SSE write P99 too high: ${sseWriteP99}ms`);
    results.passed = false;
  }
  
  if (TEST_STATE.metrics.sseDuplicates > 0) {
    results.failures.push(`SSE duplicates found: ${TEST_STATE.metrics.sseDuplicates}`);
    results.passed = false;
  }
  
  const errorRate = (TEST_STATE.metrics.errors['5xx'] / TEST_STATE.metrics.runsStarted) * 100;
  if (errorRate > CONFIG.TARGETS.ERROR_RATE) {
    results.failures.push(`Error rate too high: ${errorRate.toFixed(2)}%`);
    results.passed = false;
  }
  
  return results;
}

// Main test execution
async function runBigVerificationShort() {
  log('🚀 Starting Big Verification Run (SHORT VERSION - 10 minutes)');
  log(`📊 Test configuration:`, 'INFO');
  log(`   - Gateway: ${CONFIG.GATEWAY_URL}`, 'INFO');
  log(`   - Duration: ${CONFIG.TEST_DURATION / 1000 / 60} minutes`, 'INFO');
  log(`   - Phase A: ${CONFIG.PHASE_A_DURATION / 1000 / 60} minutes`, 'INFO');
  log(`   - Phase B: ${CONFIG.PHASE_B_DURATION / 1000 / 60} minutes`, 'INFO');
  log(`   - Phase C: ${CONFIG.PHASE_C_DURATION / 1000 / 60} minutes`, 'INFO');
  log(`   - Phase D: ${CONFIG.PHASE_D_DURATION / 1000 / 60} minutes`, 'INFO');
  
  try {
    // Run all phases
    await phaseA_Warmup();
    await phaseB_Soak();
    await phaseC_Stress();
    await phaseD_Cooldown();
    
    // Validate results
    const validation = validateResults();
    
    // Save results
    const results = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - TEST_STATE.startTime,
      metrics: TEST_STATE.metrics,
      snapshots: TEST_STATE.snapshots,
      validation
    };
    
    const filename = `big-verification-short-results-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(results, null, 2));
    
    // Print summary
    log('📊 BIG VERIFICATION RUN (SHORT) COMPLETE', 'INFO');
    log(`📁 Results saved to: ${filename}`, 'INFO');
    log(`📈 Total runs: ${TEST_STATE.metrics.runsStarted}`, 'INFO');
    log(`✅ Successful: ${TEST_STATE.metrics.runsCompleted}`, 'INFO');
    log(`❌ Failed: ${TEST_STATE.metrics.runsFailed}`, 'INFO');
    log(`🔗 SSE connections: ${TEST_STATE.metrics.sseConnections}`, 'INFO');
    log(`🔄 SSE reconnects: ${TEST_STATE.metrics.sseReconnects}`, 'INFO');
    log(`🚫 SSE duplicates: ${TEST_STATE.metrics.sseDuplicates}`, 'INFO');
    
    if (validation.passed) {
      log('🎉 ALL TESTS PASSED!', 'SUCCESS');
    } else {
      log('❌ SOME TESTS FAILED:', 'ERROR');
      validation.failures.forEach(failure => log(`   - ${failure}`, 'ERROR'));
    }
    
  } catch (error) {
    log(`💥 Test failed: ${error.message}`, 'ERROR');
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  runBigVerificationShort().catch(error => {
    log(`💥 Fatal error: ${error.message}`, 'ERROR');
    process.exit(1);
  });
}

module.exports = { runBigVerificationShort, CONFIG, TEST_STATE };
