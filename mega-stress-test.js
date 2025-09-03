const http = require('http');
const https = require('https');
const crypto = require('crypto');

// Configuration for MEGA STRESS TEST
const CONFIG = {
  BASE_URL: 'http://localhost:3000',
  DURATION_MS: 10 * 60 * 1000, // 10 minutes
  CONCURRENT_RUNS: 100, // 100 concurrent run creators
  CONCURRENT_SSE: 50, // 50 concurrent SSE connections
  BURST_SIZE: 200, // 200 requests per burst
  BURST_INTERVAL_MS: 5000, // Burst every 5 seconds
  SSE_CHURN_INTERVAL_MS: 30000, // SSE churn every 30 seconds
  METRICS_INTERVAL_MS: 10000, // Metrics every 10 seconds
  CHAOS_INTERVAL_MS: 60000, // Chaos every 60 seconds
};

// Test state
const TEST_STATE = {
  startTime: Date.now(),
  metrics: {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    runsCreated: 0,
    runsStarted: 0,
    runsCompleted: 0,
    sseConnections: 0,
    sseReconnects: 0,
    sseMessages: 0,
    chaosEvents: 0,
  },
  sseClients: new Map(),
  activeRuns: new Set(),
  completedRuns: new Set(),
  errors: [],
  logs: [],
};

// Utility functions
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const elapsed = Math.floor((Date.now() - TEST_STATE.startTime) / 1000);
  const logEntry = `[${timestamp}] [T+${elapsed}s] [${level}] ${message}`;
  console.log(logEntry);
  TEST_STATE.logs.push(logEntry);
}

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, CONFIG.BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
        'X-Workspace-ID': 'mega-stress-test',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        TEST_STATE.metrics.totalRequests++;
        if (res.statusCode >= 200 && res.statusCode < 300) {
          TEST_STATE.metrics.successfulRequests++;
        } else {
          TEST_STATE.metrics.failedRequests++;
          TEST_STATE.errors.push(`${method} ${path}: ${res.statusCode} - ${data}`);
        }
        
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', (err) => {
      TEST_STATE.metrics.totalRequests++;
      TEST_STATE.metrics.failedRequests++;
      TEST_STATE.errors.push(`${method} ${path}: ${err.message}`);
      reject(err);
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

// SSE Client class
class SSEClient {
  constructor(id, path) {
    this.id = id;
    this.path = path;
    this.connected = false;
    this.lastEventId = null;
    this.messageCount = 0;
    this.reconnectCount = 0;
    this.connect();
  }

  connect() {
    const url = new URL(this.path, CONFIG.BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Authorization': 'Bearer test-token',
        'X-Workspace-ID': 'mega-stress-test',
        ...(this.lastEventId && { 'Last-Event-ID': this.lastEventId })
      }
    };

    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        this.connected = true;
        TEST_STATE.metrics.sseConnections++;
        log(`🔌 SSE ${this.id} connected`);
        
        res.on('data', (chunk) => {
          const data = chunk.toString();
          const lines = data.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('id: ')) {
              this.lastEventId = line.substring(4);
            } else if (line.startsWith('data: ')) {
              this.messageCount++;
              TEST_STATE.metrics.sseMessages++;
            }
          }
        });

        res.on('end', () => {
          this.connected = false;
          TEST_STATE.metrics.sseConnections--;
          log(`🔌 SSE ${this.id} disconnected`);
          this.scheduleReconnect();
        });

        res.on('error', (err) => {
          this.connected = false;
          TEST_STATE.metrics.sseConnections--;
          log(`❌ SSE ${this.id} error: ${err.message}`, 'ERROR');
          this.scheduleReconnect();
        });
      } else {
        log(`❌ SSE ${this.id} failed: ${res.statusCode}`, 'ERROR');
        this.scheduleReconnect();
      }
    });

    req.on('error', (err) => {
      log(`❌ SSE ${this.id} connection error: ${err.message}`, 'ERROR');
      this.scheduleReconnect();
    });

    req.end();
  }

  scheduleReconnect() {
    if (this.reconnectCount < 10) {
      this.reconnectCount++;
      TEST_STATE.metrics.sseReconnects++;
      setTimeout(() => this.connect(), 1000 + Math.random() * 2000);
    }
  }

  disconnect() {
    this.connected = false;
    TEST_STATE.metrics.sseConnections--;
  }
}

// Run creator worker
async function runCreatorWorker(workerId) {
  const interval = setInterval(async () => {
    try {
      // Create run
      const runId = crypto.randomUUID();
      const createResponse = await makeRequest('POST', '/api/runs', {
        id: runId,
        name: `Mega-Stress-Run-${workerId}-${Date.now()}`,
        input: `Stress test input from worker ${workerId}`,
        privacy: { mode: 'full' },
        safety: { enabled: false }
      });

      if (createResponse.status === 201) {
        TEST_STATE.metrics.runsCreated++;
        TEST_STATE.activeRuns.add(runId);

        // Start run
        const startResponse = await makeRequest('POST', `/api/runs/${runId}/start`);
        if (startResponse.status === 200) {
          TEST_STATE.metrics.runsStarted++;
        }

        // Monitor run completion
        setTimeout(async () => {
          try {
            const statusResponse = await makeRequest('GET', `/api/runs/${runId}`);
            if (statusResponse.status === 200 && statusResponse.data.status === 'completed') {
              TEST_STATE.metrics.runsCompleted++;
              TEST_STATE.completedRuns.add(runId);
              TEST_STATE.activeRuns.delete(runId);
            }
          } catch (err) {
            log(`❌ Run status check failed for ${runId}: ${err.message}`, 'ERROR');
          }
        }, 5000);
      }
    } catch (err) {
      log(`❌ Run creator worker ${workerId} error: ${err.message}`, 'ERROR');
    }
  }, 2000 + Math.random() * 3000); // Random interval between 2-5 seconds

  return interval;
}

// Burst attacker
async function burstAttacker() {
  const interval = setInterval(async () => {
    log(`💥 Firing burst of ${CONFIG.BURST_SIZE} requests`);
    
    const promises = [];
    for (let i = 0; i < CONFIG.BURST_SIZE; i++) {
      promises.push(
        makeRequest('POST', '/api/runs', {
          name: `Burst-Run-${Date.now()}-${i}`,
          input: `Burst test ${i}`,
          privacy: { mode: 'hash-only' },
          safety: { enabled: true }
        }).catch(err => ({ status: 500, data: { error: err.message } }))
      );
    }

    try {
      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.status === 201).length;
      const errorCount = results.filter(r => r.status !== 201).length;
      log(`💥 Burst complete: ${successCount} success, ${errorCount} errors`);
    } catch (err) {
      log(`❌ Burst failed: ${err.message}`, 'ERROR');
    }
  }, CONFIG.BURST_INTERVAL_MS);

  return interval;
}

// SSE churn manager
function sseChurnManager() {
  const interval = setInterval(() => {
    const clients = Array.from(TEST_STATE.sseClients.values());
    const churnCount = Math.floor(clients.length * 0.3); // Churn 30%
    
    log(`🔄 SSE churn: closing ${churnCount}/${clients.length} clients`);
    
    // Close random clients
    for (let i = 0; i < churnCount; i++) {
      const randomClient = clients[Math.floor(Math.random() * clients.length)];
      if (randomClient) {
        randomClient.disconnect();
        TEST_STATE.sseClients.delete(randomClient.id);
      }
    }

    // Create new clients
    setTimeout(() => {
      for (let i = 0; i < churnCount; i++) {
        const clientId = `sse-replace-${Date.now()}-${i}`;
        const client = new SSEClient(clientId, '/api/runs/logs/stream');
        TEST_STATE.sseClients.set(clientId, client);
      }
      log(`🔄 SSE churn: replaced ${churnCount} clients`);
    }, 1000);
  }, CONFIG.SSE_CHURN_INTERVAL_MS);

  return interval;
}

// Metrics reporter
function metricsReporter() {
  const interval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - TEST_STATE.startTime) / 1000);
    const successRate = TEST_STATE.metrics.totalRequests > 0 
      ? ((TEST_STATE.metrics.successfulRequests / TEST_STATE.metrics.totalRequests) * 100).toFixed(2)
      : '0.00';
    
    log(`📊 MEGA STRESS METRICS [T+${elapsed}s]`);
    log(`   Requests: ${TEST_STATE.metrics.totalRequests} total, ${TEST_STATE.metrics.successfulRequests} success (${successRate}%)`);
    log(`   Runs: ${TEST_STATE.metrics.runsCreated} created, ${TEST_STATE.metrics.runsStarted} started, ${TEST_STATE.metrics.runsCompleted} completed`);
    log(`   SSE: ${TEST_STATE.metrics.sseConnections} active, ${TEST_STATE.metrics.sseReconnects} reconnects, ${TEST_STATE.metrics.sseMessages} messages`);
    log(`   Active Runs: ${TEST_STATE.activeRuns.size}, Completed: ${TEST_STATE.completedRuns.size}`);
    log(`   Errors: ${TEST_STATE.errors.length}`);
  }, CONFIG.METRICS_INTERVAL_MS);

  return interval;
}

// Chaos injector
function chaosInjector() {
  const interval = setInterval(() => {
    TEST_STATE.metrics.chaosEvents++;
    log(`🌪️ CHAOS EVENT #${TEST_STATE.metrics.chaosEvents}: Simulating high load`);
    
    // Create extra burst during chaos
    setTimeout(async () => {
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          makeRequest('POST', '/api/runs', {
            name: `Chaos-Run-${Date.now()}-${i}`,
            input: `Chaos test ${i}`,
            privacy: { mode: 'full' },
            safety: { enabled: false }
          }).catch(err => ({ status: 500, data: { error: err.message } }))
        );
      }
      
      try {
        const results = await Promise.all(promises);
        const successCount = results.filter(r => r.status === 201).length;
        log(`🌪️ Chaos burst: ${successCount}/50 successful`);
      } catch (err) {
        log(`❌ Chaos burst failed: ${err.message}`, 'ERROR');
      }
    }, 1000);
  }, CONFIG.CHAOS_INTERVAL_MS);

  return interval;
}

// Main test execution
async function runMegaStressTest() {
  log('🚀 STARTING MEGA STRESS TEST - Real Gateway Verification');
  log(`📋 Configuration: ${CONFIG.DURATION_MS/1000}s duration, ${CONFIG.CONCURRENT_RUNS} run workers, ${CONFIG.CONCURRENT_SSE} SSE clients`);
  log(`📋 Burst: ${CONFIG.BURST_SIZE} requests every ${CONFIG.BURST_INTERVAL_MS/1000}s`);
  
  const intervals = [];

  // Initialize SSE clients
  log('🔌 Initializing SSE clients...');
  for (let i = 0; i < CONFIG.CONCURRENT_SSE; i++) {
    const clientId = `sse-${i}`;
    const client = new SSEClient(clientId, '/api/runs/logs/stream');
    TEST_STATE.sseClients.set(clientId, client);
  }

  // Start run creator workers
  log('🏃 Starting run creator workers...');
  for (let i = 0; i < CONFIG.CONCURRENT_RUNS; i++) {
    const interval = await runCreatorWorker(i);
    intervals.push(interval);
  }

  // Start burst attacker
  log('💥 Starting burst attacker...');
  intervals.push(burstAttacker());

  // Start SSE churn manager
  log('🔄 Starting SSE churn manager...');
  intervals.push(sseChurnManager());

  // Start metrics reporter
  log('📊 Starting metrics reporter...');
  intervals.push(metricsReporter());

  // Start chaos injector
  log('🌪️ Starting chaos injector...');
  intervals.push(chaosInjector());

  // Wait for test duration
  await new Promise(resolve => setTimeout(resolve, CONFIG.DURATION_MS));

  // Cleanup
  log('🧹 Cleaning up...');
  intervals.forEach(clearInterval);
  TEST_STATE.sseClients.forEach(client => client.disconnect());

  // Final results
  const elapsed = Math.floor((Date.now() - TEST_STATE.startTime) / 1000);
  const successRate = TEST_STATE.metrics.totalRequests > 0 
    ? ((TEST_STATE.metrics.successfulRequests / TEST_STATE.metrics.totalRequests) * 100).toFixed(2)
    : '0.00';

  log('📊 MEGA STRESS TEST COMPLETE');
  log(`⏱️ Duration: ${elapsed} seconds`);
  log(`📈 Total Requests: ${TEST_STATE.metrics.totalRequests}`);
  log(`✅ Successful: ${TEST_STATE.metrics.successfulRequests} (${successRate}%)`);
  log(`❌ Failed: ${TEST_STATE.metrics.failedRequests}`);
  log(`🏃 Runs Created: ${TEST_STATE.metrics.runsCreated}`);
  log(`🚀 Runs Started: ${TEST_STATE.metrics.runsStarted}`);
  log(`✅ Runs Completed: ${TEST_STATE.metrics.runsCompleted}`);
  log(`🔌 SSE Connections: ${TEST_STATE.metrics.sseConnections}`);
  log(`🔄 SSE Reconnects: ${TEST_STATE.metrics.sseReconnects}`);
  log(`📨 SSE Messages: ${TEST_STATE.metrics.sseMessages}`);
  log(`🌪️ Chaos Events: ${TEST_STATE.metrics.chaosEvents}`);
  log(`🚨 Total Errors: ${TEST_STATE.errors.length}`);

  if (TEST_STATE.errors.length > 0) {
    log('❌ ERRORS ENCOUNTERED:', 'ERROR');
    TEST_STATE.errors.slice(0, 10).forEach(error => log(`   ${error}`, 'ERROR'));
    if (TEST_STATE.errors.length > 10) {
      log(`   ... and ${TEST_STATE.errors.length - 10} more errors`, 'ERROR');
    }
  }

  // Save results
  const results = {
    timestamp: new Date().toISOString(),
    duration: elapsed,
    metrics: TEST_STATE.metrics,
    errors: TEST_STATE.errors,
    logs: TEST_STATE.logs
  };

  require('fs').writeFileSync(`mega-stress-results-${Date.now()}.json`, JSON.stringify(results, null, 2));
  log(`📁 Results saved to: mega-stress-results-${Date.now()}.json`);

  // Exit with appropriate code
  const exitCode = TEST_STATE.metrics.failedRequests === 0 ? 0 : 1;
  log(`🏁 MEGA STRESS TEST ${exitCode === 0 ? 'PASSED' : 'FAILED'} - Exiting with code ${exitCode}`);
  process.exit(exitCode);
}

// Handle shutdown gracefully
process.on('SIGINT', () => {
  log('🛑 Received SIGINT - Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('🛑 Received SIGTERM - Shutting down gracefully...');
  process.exit(0);
});

// Start the mega stress test
runMegaStressTest().catch(err => {
  log(`💥 MEGA STRESS TEST CRASHED: ${err.message}`, 'ERROR');
  log(err.stack, 'ERROR');
  process.exit(1);
});
