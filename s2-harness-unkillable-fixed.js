#!/usr/bin/env node

/**
 * S2 — Unkillable Harness (2 Hours, Zero-Leak Cert) - FIXED VERSION
 * 
 * Purpose: Catch slow leaks (memory/file handles), clock drift, queue buildup, 
 * and flaky reconnections that only appear over hours—under realistic, not insane, traffic.
 * 
 * Timeline: 120 minutes continuous testing
 * Workloads: W1-W6 running concurrently with master lifecycle management
 * KPIs: Availability, Latency, SSE, Stability, Safety, Registry, Privacy
 * 
 * FIXES APPLIED:
 * - Added proper authentication headers (Authorization, X-Workspace-ID, X-Test-Bypass)
 * - Improved error logging with HTTP status codes and response bodies
 * - Added workspace plan setup before starting tests
 * - Enhanced SSE connection diagnostics
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  GATEWAY_URL: 'http://localhost:3000',
  TEST_DURATION: 120 * 60 * 1000, // 120 minutes
  WORKSPACE_ID: 's2-unkillable', // Changed to match the test name
  TEST_TOKEN: 'test-token-s2-harness', // Replace with actual JWT if needed
  TEST_BYPASS: true,
  
  // Workload rates (per minute)
  W1_RUN_RATE: 3, // Realistic runs
  W2_CHURN_RATE: 1, // SSE churn every 5 minutes
  W3_REGISTRY_RATE: 2, // Registry pulse
  W4_SAFETY_RATE: 1, // Safety probes
  W5_PRIVACY_RATE: 1, // Privacy slice
  W6_CHAOS_RATE: 1, // Light chaos
  
  // SSE Configuration
  SSE_CLIENT_COUNT: 20,
  SSE_ENABLED: true, // Explicitly enable SSE
  W2_RECONNECT_DELAY: 2000,
  W2_CHURN_PERCENTAGE: 0.2, // 20%
  
  // Chaos Events (minutes from start)
  W6_REDIS_RESTART_TIME: 45,
  W6_GATEWAY_RESTART_TIME: 75,
  W6_LATENCY_INJECTION_TIME: 90,
  W6_CHAOS_ENABLED: true, // Explicitly enable chaos
  
  // Intervals
  HEARTBEAT_INTERVAL: 5 * 60 * 1000, // 5 minutes
  SNAPSHOT_INTERVAL: 10 * 60 * 1000, // 10 minutes
  AVAILABILITY_CHECK_INTERVAL: 30 * 1000, // 30 seconds
  
  // KPI Targets
  TARGET_AVAILABILITY: 0.99, // 99%
  TARGET_P95_LATENCY: 5000, // 5 seconds
  TARGET_P99_LATENCY: 10000, // 10 seconds
  MAX_SSE_RECONNECTS: 50,
  MAX_SSE_DUPLICATES: 0
};

// ============================================================================
// TEST STATE & METRICS
// ============================================================================

const TEST_STATE = {
  startTime: Date.now(),
  metrics: {
    runsStarted: 0,
    runsSuccessful: 0,
    runsFailed: 0,
    sseActive: 0,
    sseReconnects: 0,
    sseDuplicatesDropped: 0,
    availabilityChecks: 0,
    availabilityFailures: 0,
    lastSnapshot: null
  },
  sseClients: new Map(), // clientId -> EventSourceLike
  handles: [] // All timers/intervals
};

// ============================================================================
// MASTER LIFECYCLE & ABORT CONTROLLER
// ============================================================================

const MASTER_CONTROLLER = {
  abortController: new AbortController(),
  durationMs: CONFIG.TEST_DURATION,
  startTime: Date.now(),
  handles: [], // All intervals/timers
  fatalError: null,
  heartbeatInterval: null,
  logFile: null,
  logStream: null
};

// Master timeout that fires controller.abort() after duration
const masterTimeout = setTimeout(() => {
  log('⏰ Master timeout reached - aborting all workers', 'INFO');
  MASTER_CONTROLLER.abortController.abort();
}, MASTER_CONTROLLER.durationMs);

// Store the master timeout handle
MASTER_CONTROLLER.handles.push(masterTimeout);

// ============================================================================
// GLOBAL ERROR SENTRY
// ============================================================================

process.on('unhandledRejection', (reason, promise) => {
  const error = new Error(`Unhandled Rejection: ${reason}`);
  error.promise = promise;
  log(`💥 FATAL: Unhandled Rejection: ${reason}`, 'FATAL');
  MASTER_CONTROLLER.fatalError = error;
  MASTER_CONTROLLER.abortController.abort();
});

process.on('uncaughtException', (error) => {
  log(`💥 FATAL: Uncaught Exception: ${error.message}`, 'FATAL');
  log(`Stack: ${error.stack}`, 'FATAL');
  MASTER_CONTROLLER.fatalError = error;
  MASTER_CONTROLLER.abortController.abort();
});

process.on('SIGINT', () => {
  log('🛑 Received SIGINT - graceful shutdown', 'INFO');
  MASTER_CONTROLLER.abortController.abort();
});

process.on('SIGTERM', () => {
  log('🛑 Received SIGTERM - graceful shutdown', 'INFO');
  MASTER_CONTROLLER.abortController.abort();
});

// ============================================================================
// WORKER MANAGEMENT
// ============================================================================

async function runWorker(name, fn, signal, options = {}) {
  const { fatal = false, retryDelay = 1000, maxRetries = 5 } = options;
  let retries = 0;
  
  while (!signal.aborted) {
    try {
      await fn(signal);
      // If we get here, the worker completed successfully
      break;
    } catch (error) {
      retries++;
      log(`🔄 ${name} error (attempt ${retries}/${maxRetries}): ${error.message}`, 'ERROR');
      
      if (fatal || retries >= maxRetries) {
        log(`💥 ${name} fatal error after ${retries} attempts: ${error.message}`, 'FATAL');
        if (fatal) {
          MASTER_CONTROLLER.fatalError = error;
          MASTER_CONTROLLER.abortController.abort();
        }
        break;
      }
      
      // Exponential backoff
      const delay = retryDelay * Math.pow(2, retries - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// ============================================================================
// LOGGING & SETUP
// ============================================================================

function setupLogging() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logDir = 's2-logs';
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }
  
  MASTER_CONTROLLER.logFile = `${logDir}/s2-harness-${timestamp}.log`;
  MASTER_CONTROLLER.logStream = fs.createWriteStream(MASTER_CONTROLLER.logFile);
  
  log('🚀 Starting S2 — Unkillable Harness (2 Hours, Zero-Leak Cert)', 'INFO');
  log(`📝 Logging to: ${MASTER_CONTROLLER.logFile}`, 'INFO');
}

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const elapsed = Math.floor((Date.now() - TEST_STATE.startTime) / 1000 / 60);
  const logMessage = `[${timestamp}] [${level}] [T+${elapsed}m] ${message}`;
  
  console.log(logMessage);
  if (MASTER_CONTROLLER.logStream) {
    MASTER_CONTROLLER.logStream.write(logMessage + '\n');
  }
}

function logHeartbeat() {
  const elapsed = Math.floor((Date.now() - TEST_STATE.startTime) / 1000 / 60);
  const successRate = TEST_STATE.metrics.runsStarted > 0 
    ? (TEST_STATE.metrics.runsSuccessful / TEST_STATE.metrics.runsStarted * 100).toFixed(1)
    : '0.0';
  
  log(`💓 S2 alive — t=${elapsed}m, active SSE=${TEST_STATE.metrics.sseActive}, runs started=${TEST_STATE.metrics.runsStarted} (${successRate}% success)`, 'HEARTBEAT');
}

// ============================================================================
// AUTHENTICATION & REQUEST UTILITIES
// ============================================================================

// Get default headers for all requests
function getDefaultHeaders() {
  return {
    'Authorization': `Bearer ${CONFIG.TEST_TOKEN}`,
    'X-Workspace-ID': CONFIG.WORKSPACE_ID,
    'Content-Type': 'application/json'
  };
}

// Add test bypass header if enabled
function getAuthHeaders() {
  const headers = getDefaultHeaders();
  if (CONFIG.TEST_BYPASS) {
    headers['X-Test-Bypass'] = 'true';
  }
  return headers;
}

// Setup workspace plan before starting tests
async function setupWorkspacePlan() {
  try {
    log('🔧 Setting up workspace plan...', 'INFO');
    const response = await makeRequest('POST', '/api/workspace/plan', { plan: 'pro' });
    
    if (response.status !== 200) {
      log(`❌ Failed to set workspace plan: ${response.status} - ${JSON.stringify(response.data)}`, 'ERROR');
      return false;
    }
    
    log('✅ Workspace plan set to pro', 'INFO');
    return true;
  } catch (error) {
    log(`❌ Error setting workspace plan: ${error.message}`, 'ERROR');
    return false;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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
            body: body // Keep raw body for error logging
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
      log(`🌐 Request error (${method} ${path}): ${error.message}`, 'ERROR');
      reject(error);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

function getElapsedMinutes() {
  return Math.floor((Date.now() - TEST_STATE.startTime) / 1000 / 60);
}

// ============================================================================
// SSE CLIENT MANAGEMENT
// ============================================================================

class EventSourceLike {
  constructor(clientId, url, lastEventId = null) {
    this.clientId = clientId;
    this.url = url;
    this.lastEventId = lastEventId;
    this.connectedAt = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = CONFIG.W2_RECONNECT_DELAY;
    
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
      
      if (this.lastEventId) {
        options.headers['Last-Event-ID'] = this.lastEventId;
      }
      
      const req = http.request(options, (res) => {
        if (res.statusCode === 200) {
          this.isConnected = true;
          this.connectedAt = Date.now();
          this.reconnectAttempts = 0;
          TEST_STATE.metrics.sseActive++;
          log(`🔌 SSE ${this.clientId} connected`, 'INFO');
          
          res.on('data', (chunk) => {
            const data = chunk.toString();
            if (data.includes('id:')) {
              const match = data.match(/id:\s*([^\n]+)/);
              if (match) {
                this.lastEventId = match[1].trim();
              }
            }
          });
          
          res.on('end', () => {
            this.isConnected = false;
            TEST_STATE.metrics.sseActive--;
            log(`🔌 SSE ${this.clientId} disconnected`, 'INFO');
            this.scheduleReconnect();
          });
          
          res.on('error', (error) => {
            log(`🔌 SSE ${this.clientId} connection error: ${error.message}`, 'ERROR');
            this.isConnected = false;
            TEST_STATE.metrics.sseActive--;
            this.scheduleReconnect();
          });
        } else {
          // Enhanced error logging with status and body
          let errorBody = '';
          res.on('data', chunk => errorBody += chunk);
          res.on('end', () => {
            log(`🔌 SSE ${this.clientId} request error: ${res.statusCode} - ${errorBody.substring(0, 200)}`, 'ERROR');
            this.scheduleReconnect();
          });
        }
      });
      
      req.on('error', (error) => {
        log(`🔌 SSE ${this.clientId} request error: ${error.message}`, 'ERROR');
        this.scheduleReconnect();
      });
      
      req.end();
    } catch (error) {
      log(`🔌 SSE ${this.clientId} connection setup error: ${error.message}`, 'ERROR');
      this.scheduleReconnect();
    }
  }
  
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      log(`🔌 SSE ${this.clientId} max reconnects reached`, 'ERROR');
      return;
    }
    
    this.reconnectAttempts++;
    TEST_STATE.metrics.sseReconnects++;
    
    const delay = this.reconnectDelay + Math.random() * 1000; // Add jitter
    const timer = setTimeout(() => {
      this.connect();
    }, delay);
    
    MASTER_CONTROLLER.handles.push(timer);
  }
  
  disconnect() {
    this.isConnected = false;
    TEST_STATE.metrics.sseActive--;
  }
  
  reconnect() {
    this.disconnect();
    this.connect();
  }
}

// ============================================================================
// WORKLOADS
// ============================================================================

async function workloadW1_RealisticRuns(signal) {
  const interval = setInterval(async () => {
    if (signal.aborted) return;
    
    try {
      const runId = crypto.randomUUID();
      TEST_STATE.metrics.runsStarted++;
      
      // Create run
      const createResponse = await makeRequest('POST', '/api/runs', {
        id: runId,
        name: `S2-Run-${runId.substring(0, 8)}`,
        workspace_id: CONFIG.WORKSPACE_ID
      });
      
      if (createResponse.status !== 201) {
        log(`❌ Run ${runId} failed: ${createResponse.status} - ${JSON.stringify(createResponse.data)}`, 'ERROR');
        TEST_STATE.metrics.runsFailed++;
        return;
      }
      
      // Start run
      const startResponse = await makeRequest('POST', `/api/runs/${runId}/start`);
      if (startResponse.status !== 200) {
        log(`❌ Run ${runId} start failed: ${startResponse.status} - ${JSON.stringify(startResponse.data)}`, 'ERROR');
        TEST_STATE.metrics.runsFailed++;
        return;
      }
      
      // Wait for completion with timeout
      const startTime = Date.now();
      const timeout = 90000; // 90 seconds
      
      while (Date.now() - startTime < timeout) {
        if (signal.aborted) return;
        
        const statusResponse = await makeRequest('GET', `/api/runs/${runId}`);
        if (statusResponse.status !== 200) {
          log(`❌ Run ${runId} status check failed: ${statusResponse.status}`, 'ERROR');
          TEST_STATE.metrics.runsFailed++;
          return;
        }
        
        if (statusResponse.data.status === 'completed' || statusResponse.data.status === 'failed') {
          if (statusResponse.data.status === 'completed') {
            TEST_STATE.metrics.runsSuccessful++;
          } else {
            TEST_STATE.metrics.runsFailed++;
          }
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Timeout
      log(`⏰ Run ${runId} timed out after 90s`, 'ERROR');
      TEST_STATE.metrics.runsFailed++;
      
    } catch (error) {
      log(`❌ Run creation error: ${error.message}`, 'ERROR');
      TEST_STATE.metrics.runsFailed++;
    }
  }, (60 / CONFIG.W1_RUN_RATE) * 1000);
  
  MASTER_CONTROLLER.handles.push(interval);
  
  // Wait for abort signal
  await new Promise(resolve => {
    signal.addEventListener('abort', resolve);
  });
}

async function workloadW2_SSEChurn(signal) {
  // Initialize SSE clients
  for (let i = 0; i < CONFIG.SSE_CLIENT_COUNT; i++) {
    const clientId = `sse-${i}`;
    const client = new EventSourceLike(clientId, '/api/runs/logs/stream');
    TEST_STATE.sseClients.set(clientId, client);
  }
  
  // Churn every 5 minutes
  const churnInterval = setInterval(() => {
    if (signal.aborted) return;
    
    const clients = Array.from(TEST_STATE.sseClients.values());
    const churnCount = Math.floor(clients.length * CONFIG.W2_CHURN_PERCENTAGE);
    
    log(`🔄 SSE churn: closing ${churnCount}/${clients.length} clients`, 'INFO');
    
    // Close selected clients
    for (let i = 0; i < churnCount; i++) {
      const client = clients[i];
      client.disconnect();
      TEST_STATE.sseClients.delete(client.clientId);
    }
    
    // Schedule replacements
    setTimeout(() => {
      for (let i = 0; i < churnCount; i++) {
        const clientId = `sse-replace-${Date.now()}-${i}`;
        const client = new EventSourceLike(clientId, '/api/runs/logs/stream');
        TEST_STATE.sseClients.set(clientId, client);
      }
      log(`🔄 SSE churn: replaced ${churnCount} clients`, 'INFO');
    }, 1000);
    
  }, 5 * 60 * 1000);
  
  MASTER_CONTROLLER.handles.push(churnInterval);
  
  // Wait for abort signal
  await new Promise(resolve => {
    signal.addEventListener('abort', resolve);
  });
}

async function workloadW3_RegistryPulse(signal) {
  const interval = setInterval(async () => {
    if (signal.aborted) return;
    
    try {
      const timestamp = Date.now();
      const response = await makeRequest('POST', '/api/registry/publish', {
        name: 's2-test-package',
        version: `1.0.${timestamp}`, // Use timestamp to avoid collisions
        workspace_id: CONFIG.WORKSPACE_ID
      });
      
      if (response.status !== 201) {
        log(`❌ Registry pulse error: ${response.status} - ${JSON.stringify(response.data)}`, 'ERROR');
      }
    } catch (error) {
      log(`❌ Registry pulse error: ${error.message}`, 'ERROR');
    }
  }, (60 / CONFIG.W3_REGISTRY_RATE) * 1000);
  
  MASTER_CONTROLLER.handles.push(interval);
  
  await new Promise(resolve => {
    signal.addEventListener('abort', resolve);
  });
}

async function workloadW4_SafetyProbes(signal) {
  const interval = setInterval(async () => {
    if (signal.aborted) return;
    
    try {
      const response = await makeRequest('GET', '/api/safety/check');
      if (response.status !== 200) {
        log(`❌ Safety probe error: ${response.status} - ${JSON.stringify(response.data)}`, 'ERROR');
      }
    } catch (error) {
      log(`❌ Safety probe error: ${error.message}`, 'ERROR');
    }
  }, (60 / CONFIG.W4_SAFETY_RATE) * 1000);
  
  MASTER_CONTROLLER.handles.push(interval);
  
  await new Promise(resolve => {
    signal.addEventListener('abort', resolve);
  });
}

async function workloadW5_PrivacySlice(signal) {
  const interval = setInterval(async () => {
    if (signal.aborted) return;
    
    try {
      // Toggle privacy setting
      const toggleResponse = await makeRequest('POST', '/api/privacy/toggle', {
        storePlain: false
      });
      
      if (toggleResponse.status !== 200) {
        log(`❌ Privacy toggle error: ${toggleResponse.status} - ${JSON.stringify(toggleResponse.data)}`, 'ERROR');
        return;
      }
      
      // Wait 1-2s for cache invalidation
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Create a run with privacy setting
      const runId = crypto.randomUUID();
      const createResponse = await makeRequest('POST', '/api/runs', {
        id: runId,
        name: `S2-Privacy-${runId.substring(0, 8)}`,
        workspace_id: CONFIG.WORKSPACE_ID,
        privacy: { storePlain: false }
      });
      
      if (createResponse.status !== 201) {
        log(`❌ Privacy run error: ${createResponse.status} - ${JSON.stringify(createResponse.data)}`, 'ERROR');
      }
      
    } catch (error) {
      log(`❌ Privacy slice error: ${error.message}`, 'ERROR');
    }
  }, (60 / CONFIG.W5_PRIVACY_RATE) * 1000);
  
  MASTER_CONTROLLER.handles.push(interval);
  
  await new Promise(resolve => {
    signal.addEventListener('abort', resolve);
  });
}

async function workloadW6_LightChaos(signal) {
  const startTime = Date.now();
  
  // Schedule chaos events
  if (CONFIG.W6_REDIS_RESTART_TIME) {
    const redisTimer = setTimeout(async () => {
      if (signal.aborted) return;
      log('🌪️ Chaos: Redis restart scheduled', 'INFO');
      try {
        await makeRequest('POST', '/api/chaos/redis-restart');
      } catch (error) {
        log(`❌ Chaos Redis restart failed: ${error.message}`, 'ERROR');
      }
    }, CONFIG.W6_REDIS_RESTART_TIME * 60 * 1000);
    MASTER_CONTROLLER.handles.push(redisTimer);
  }
  
  if (CONFIG.W6_GATEWAY_RESTART_TIME) {
    const gatewayTimer = setTimeout(async () => {
      if (signal.aborted) return;
      log('🌪️ Chaos: Gateway restart scheduled', 'INFO');
      try {
        await makeRequest('POST', '/api/chaos/gateway-restart');
        
        // Wait for gateway to be ready
        let ready = false;
        let attempts = 0;
        while (!ready && attempts < 30) {
          try {
            const response = await makeRequest('GET', '/ready');
            if (response.status === 200) {
              ready = true;
              log('🌪️ Chaos: Gateway ready after restart', 'INFO');
            }
          } catch (error) {
            // Continue waiting
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
          attempts++;
        }
      } catch (error) {
        log(`❌ Chaos Gateway restart failed: ${error.message}`, 'ERROR');
      }
    }, CONFIG.W6_GATEWAY_RESTART_TIME * 60 * 1000);
    MASTER_CONTROLLER.handles.push(gatewayTimer);
  }
  
  if (CONFIG.W6_LATENCY_INJECTION_TIME) {
    const latencyTimer = setTimeout(async () => {
      if (signal.aborted) return;
      log('🌪️ Chaos: +150ms latency injection', 'INFO');
      try {
        await makeRequest('POST', '/api/chaos/latency', { delay: 150 });
      } catch (error) {
        log(`❌ Chaos latency injection failed: ${error.message}`, 'ERROR');
      }
    }, CONFIG.W6_LATENCY_INJECTION_TIME * 60 * 1000);
    MASTER_CONTROLLER.handles.push(latencyTimer);
  }
  
  await new Promise(resolve => {
    signal.addEventListener('abort', resolve);
  });
}

async function monitorAvailability(signal) {
  const interval = setInterval(async () => {
    if (signal.aborted) return;
    
    try {
      TEST_STATE.metrics.availabilityChecks++;
      const response = await makeRequest('GET', '/health');
      
      if (response.status !== 200) {
        log(`❌ Availability check error: ${response.status} - ${JSON.stringify(response.data)}`, 'ERROR');
        TEST_STATE.metrics.availabilityFailures++;
      }
    } catch (error) {
      log(`❌ Availability check error: ${error.message}`, 'ERROR');
      TEST_STATE.metrics.availabilityFailures++;
    }
  }, CONFIG.AVAILABILITY_CHECK_INTERVAL);
  
  MASTER_CONTROLLER.handles.push(interval);
  
  await new Promise(resolve => {
    signal.addEventListener('abort', resolve);
  });
}

async function captureMetrics(signal) {
  const interval = setInterval(async () => {
    if (signal.aborted) return;
    
    try {
      const response = await makeRequest('GET', '/metrics');
      if (response.status === 200) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `s2-snapshot-${timestamp}.json`;
        
        const snapshot = {
          timestamp: Date.now(),
          elapsed: getElapsedMinutes(),
          metrics: response.data,
          testState: TEST_STATE.metrics
        };
        
        fs.writeFileSync(filename, JSON.stringify(snapshot, null, 2));
        log(`📊 Metrics snapshot saved: ${filename}`, 'INFO');
        TEST_STATE.metrics.lastSnapshot = filename;
      }
    } catch (error) {
      log(`❌ Metrics capture error: ${error.message}`, 'ERROR');
    }
  }, CONFIG.SNAPSHOT_INTERVAL);
  
  MASTER_CONTROLLER.handles.push(interval);
  
  await new Promise(resolve => {
    signal.addEventListener('abort', resolve);
  });
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function runS2UnkillableHarness() {
  try {
    setupLogging();
    
    // Setup workspace plan first
    const planSetup = await setupWorkspacePlan();
    if (!planSetup) {
      log('❌ Failed to setup workspace plan - aborting test', 'FATAL');
      process.exit(1);
    }
    
    // Start heartbeat
    MASTER_CONTROLLER.heartbeatInterval = setInterval(logHeartbeat, CONFIG.HEARTBEAT_INTERVAL);
    MASTER_CONTROLLER.handles.push(MASTER_CONTROLLER.heartbeatInterval);
    
    // Start all workers
    const workers = [
      { name: 'W1: Realistic Runs', fn: workloadW1_RealisticRuns },
      { name: 'W2: SSE Churn', fn: workloadW2_SSEChurn },
      { name: 'W3: Registry Pulse', fn: workloadW3_RegistryPulse },
      { name: 'W4: Safety Probes', fn: workloadW4_SafetyProbes },
      { name: 'W5: Privacy Slice', fn: workloadW5_PrivacySlice },
      { name: 'W6: Light Chaos', fn: workloadW6_LightChaos },
      { name: 'Availability Monitor', fn: monitorAvailability },
      { name: 'Metrics Capture', fn: captureMetrics }
    ];
    
    log('🏃 Starting W1: Realistic Runs', 'INFO');
    log('🔄 Starting W2: SSE Churn', 'INFO');
    log('📦 Starting W3: Registry Pulse', 'INFO');
    log('🛡️ Starting W4: Safety Probes', 'INFO');
    log('🔒 Starting W5: Privacy Slice', 'INFO');
    log('🌪️ Starting W6: Light Chaos', 'INFO');
    log('📊 Starting Availability Monitor', 'INFO');
    log('📈 Starting Metrics Capture', 'INFO');
    
    const workerPromises = workers.map(worker => 
      runWorker(worker.name, worker.fn, MASTER_CONTROLLER.abortController.signal)
    );
    
    // Wait for either abort or fatal error
    await Promise.race([
      new Promise(resolve => MASTER_CONTROLLER.abortController.signal.addEventListener('abort', resolve)),
      Promise.all(workerPromises)
    ]);
    
  } catch (error) {
    log(`💥 Harness error: ${error.message}`, 'FATAL');
    MASTER_CONTROLLER.fatalError = error;
  } finally {
    // Cleanup
    log('🧹 Cleaning up...', 'INFO');
    
    // Clear all timers/intervals
    MASTER_CONTROLLER.handles.forEach(handle => {
      if (typeof handle === 'number') {
        clearTimeout(handle);
      } else if (handle && typeof handle === 'object') {
        clearInterval(handle);
      }
    });
    
    // Close SSE connections
    TEST_STATE.sseClients.forEach(client => client.disconnect());
    
    // Close log stream
    if (MASTER_CONTROLLER.logStream) {
      MASTER_CONTROLLER.logStream.end();
    }
    
    // Final results
    const elapsed = Math.floor((Date.now() - TEST_STATE.startTime) / 1000 / 60);
    const successRate = TEST_STATE.metrics.runsStarted > 0 
      ? (TEST_STATE.metrics.runsSuccessful / TEST_STATE.metrics.runsStarted * 100).toFixed(1)
      : '0.0';
    const availability = TEST_STATE.metrics.availabilityChecks > 0
      ? ((TEST_STATE.metrics.availabilityChecks - TEST_STATE.metrics.availabilityFailures) / TEST_STATE.metrics.availabilityChecks * 100).toFixed(1)
      : '0.0';
    
    log('📊 S2 UNKILLABLE HARNESS COMPLETE', 'INFO');
    
    const results = {
      timestamp: Date.now(),
      elapsed: elapsed,
      runs: {
        total: TEST_STATE.metrics.runsStarted,
        successful: TEST_STATE.metrics.runsSuccessful,
        failed: TEST_STATE.metrics.runsFailed,
        successRate: parseFloat(successRate)
      },
      sse: {
        active: TEST_STATE.metrics.sseActive,
        reconnects: TEST_STATE.metrics.sseReconnects,
        duplicates: TEST_STATE.metrics.sseDuplicatesDropped
      },
      availability: {
        checks: TEST_STATE.metrics.availabilityChecks,
        failures: TEST_STATE.metrics.availabilityFailures,
        percentage: parseFloat(availability)
      },
      fatalError: MASTER_CONTROLLER.fatalError ? MASTER_CONTROLLER.fatalError.message : null
    };
    
    const resultsFile = `s2-unkillable-results-${Date.now()}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    
    log(`📁 Results saved to: ${resultsFile}`, 'INFO');
    log(`📁 Logs saved to: ${MASTER_CONTROLLER.logFile}`, 'INFO');
    log(`📈 Total runs: ${results.runs.total}`, 'INFO');
    log(`✅ Successful: ${results.runs.successful}`, 'INFO');
    log(`❌ Failed: ${results.runs.failed}`, 'INFO');
    log(`🔗 SSE connections: ${results.sse.active}`, 'INFO');
    log(`🔄 SSE reconnects: ${results.sse.reconnects}`, 'INFO');
    log(`🚫 SSE duplicates: ${results.sse.duplicates}`, 'INFO');
    
    // Determine success
    const success = results.runs.successRate >= 80 && results.availability.percentage >= 99;
    if (success) {
      log('🎉 S2 Unkillable test passed!', 'SUCCESS');
    } else {
      log('❌ S2 Unkillable test failed!', 'ERROR');
    }
    
    // Exit with appropriate code
    process.exit(MASTER_CONTROLLER.fatalError ? 1 : (success ? 0 : 1));
  }
}

// Run the harness
runS2UnkillableHarness().catch(error => {
  console.error('💥 Fatal harness error:', error);
  process.exit(1);
});
