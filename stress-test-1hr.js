#!/usr/bin/env node

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');

// Configuration
const CONFIG = {
  GATEWAY_BASE_URL: process.env.GATEWAY_BASE_URL || 'http://localhost:3000',
  TEST_DURATION_MS: 60 * 60 * 1000, // 1 hour
  CONCURRENT_USERS: 10,
  REQUESTS_PER_USER_PER_SEC: 2,
  SSE_CONNECTIONS_PER_USER: 3,
  IDEMPOTENCY_REUSE_RATE: 0.3, // 30% of requests reuse same tokens
  CANCEL_RATE: 0.1, // 10% of runs get cancelled
  METRICS_INTERVAL_MS: 30000, // Every 30 seconds
  ARTIFACT_INTERVAL_MS: 300000, // Every 5 minutes
  MAX_RETRIES: 3,
  REQUEST_TIMEOUT_MS: 10000,
  SSE_TIMEOUT_MS: 30000
};

// Test state
const testState = {
  startTime: Date.now(),
  endTime: null,
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalSSEConnections: 0,
  activeSSEConnections: 0,
  totalRuns: 0,
  cancelledRuns: 0,
  idempotentHits: 0,
  rateLimitHits: 0,
  errors: [],
  metrics: [],
  artifacts: [],
  userStates: new Map(),
  idempotencyTokens: new Set(),
  activeRuns: new Set()
};

// Test results
const results = {
  passed: 0,
  failed: 0,
  errors: [],
  summary: {}
};

console.log('🔥 1-HOUR STRESS TEST STARTING');
console.log('='.repeat(60));
console.log(`⏱️  Duration: ${CONFIG.TEST_DURATION_MS / 1000 / 60} minutes`);
console.log(`👥 Concurrent Users: ${CONFIG.CONCURRENT_USERS}`);
console.log(`📊 Requests/User/Sec: ${CONFIG.REQUESTS_PER_USER_PER_SEC}`);
console.log(`🔗 SSE Connections/User: ${CONFIG.SSE_CONNECTIONS_PER_USER}`);
console.log(`🔄 Idempotency Reuse Rate: ${CONFIG.IDEMPOTENCY_REUSE_RATE * 100}%`);
console.log(`❌ Cancel Rate: ${CONFIG.CANCEL_RATE * 100}%`);
console.log(`🌐 Gateway: ${CONFIG.GATEWAY_BASE_URL}`);
console.log('='.repeat(60));
console.log('');

// Utility functions
const makeRequest = (method, url, body = null, headers = {}, retries = 0) => {
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
        'X-Stress-Test': '1hr-test',
        'X-User-ID': headers['X-User-ID'] || 'unknown',
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

    req.on('error', (error) => {
      if (retries < CONFIG.MAX_RETRIES) {
        setTimeout(() => {
          makeRequest(method, url, body, headers, retries + 1)
            .then(resolve)
            .catch(reject);
        }, 1000 * (retries + 1));
      } else {
        reject(error);
      }
    });

    req.on('timeout', () => {
      req.destroy();
      if (retries < CONFIG.MAX_RETRIES) {
        setTimeout(() => {
          makeRequest(method, url, body, headers, retries + 1)
            .then(resolve)
            .catch(reject);
        }, 1000 * (retries + 1));
      } else {
        reject(new Error('Request timeout'));
      }
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
};

const connectSSE = (url, userId, lastEventId = null) => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const headers = {
      'Accept': 'text/event-stream',
      'X-Stress-Test': '1hr-test',
      'X-User-ID': userId,
      'SSE-Client-Name': `stress-sse-${userId}`
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
        buffer = lines.pop();
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const eventData = line.slice(6);
            try {
              const parsed = JSON.parse(eventData);
              events.push(parsed);
              
              // Resolve after receiving some events
              if (events.length >= 2 && !hasResolved) {
                hasResolved = true;
                req.destroy();
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

const collectMetrics = async () => {
  try {
    const response = await makeRequest('GET', `${CONFIG.GATEWAY_BASE_URL}/metrics`);
    const metrics = {
      timestamp: new Date().toISOString(),
      raw: response.rawData,
      parsed: {}
    };

    // Parse Prometheus metrics
    const lines = response.rawData.split('\n');
    for (const line of lines) {
      if (line.startsWith('runs_total ')) {
        metrics.parsed.runs_total = parseInt(line.split(' ')[1]);
      } else if (line.startsWith('sse_connections_opened ')) {
        metrics.parsed.sse_connections_opened = parseInt(line.split(' ')[1]);
      } else if (line.startsWith('sse_connections_closed ')) {
        metrics.parsed.sse_connections_closed = parseInt(line.split(' ')[1]);
      } else if (line.startsWith('sse_active_connections ')) {
        metrics.parsed.sse_active_connections = parseInt(line.split(' ')[1]);
      } else if (line.startsWith('sse_messages_total ')) {
        metrics.parsed.sse_messages_total = parseInt(line.split(' ')[1]);
      } else if (line.startsWith('idempotency_store_size ')) {
        metrics.parsed.idempotency_store_size = parseInt(line.split(' ')[1]);
      }
    }

    testState.metrics.push(metrics);
    return metrics;
  } catch (error) {
    console.error('❌ Failed to collect metrics:', error.message);
    return null;
  }
};

const saveArtifact = (type, data) => {
  const artifact = {
    timestamp: new Date().toISOString(),
    type,
    data,
    testState: {
      totalRequests: testState.totalRequests,
      successfulRequests: testState.successfulRequests,
      failedRequests: testState.failedRequests,
      totalSSEConnections: testState.totalSSEConnections,
      activeSSEConnections: testState.activeSSEConnections,
      totalRuns: testState.totalRuns,
      cancelledRuns: testState.cancelledRuns,
      idempotentHits: testState.idempotentHits,
      rateLimitHits: testState.rateLimitHits,
      errors: testState.errors.length
    }
  };

  testState.artifacts.push(artifact);

  // Save to file
  const artifactsDir = 'artifacts/stress-test-1hr';
  if (!fs.existsSync('artifacts')) {
    fs.mkdirSync('artifacts');
  }
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  const filename = `${artifactsDir}/${type}-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(artifact, null, 2));
};

const logStatus = () => {
  const elapsed = Date.now() - testState.startTime;
  const elapsedMinutes = Math.floor(elapsed / 60000);
  const successRate = testState.totalRequests > 0 ? 
    ((testState.successfulRequests / testState.totalRequests) * 100).toFixed(1) : '0.0';
  
  console.log(`⏱️  [${elapsedMinutes}m] 📊 Req: ${testState.totalRequests} ✅ ${testState.successfulRequests} ❌ ${testState.failedRequests} (${successRate}%) | 🔗 SSE: ${testState.activeSSEConnections} | 🏃 Runs: ${testState.totalRuns} | 🔄 Idemp: ${testState.idempotentHits} | ⚡ Rate: ${testState.rateLimitHits}`);
};

// User simulation
const simulateUser = async (userId) => {
  const userState = {
    userId,
    runs: new Set(),
    sseConnections: new Set(),
    idempotencyTokens: new Set(),
    lastRequestTime: 0
  };
  testState.userStates.set(userId, userState);

  const interval = setInterval(async () => {
    if (Date.now() - testState.startTime >= CONFIG.TEST_DURATION_MS) {
      clearInterval(interval);
      return;
    }

    try {
      // Create run
      const shouldReuseToken = Math.random() < CONFIG.IDEMPOTENCY_REUSE_RATE && userState.idempotencyTokens.size > 0;
      const clientToken = shouldReuseToken ? 
        Array.from(userState.idempotencyTokens)[Math.floor(Math.random() * userState.idempotencyTokens.size)] :
        `stress-${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const runPayload = {
        name: `Stress Test Run ${userId}-${Date.now()}`,
        input: {
          userId,
          timestamp: new Date().toISOString(),
          stressTest: true
        },
        client_token: clientToken,
        tags: ['stress-test', `user-${userId}`, '1hr-test']
      };

      testState.totalRequests++;
      const createResponse = await makeRequest('POST', `${CONFIG.GATEWAY_BASE_URL}/api/runs`, runPayload, { 'X-User-ID': userId });
      
      if (createResponse.statusCode === 201) {
        testState.successfulRequests++;
        testState.totalRuns++;
        const runId = createResponse.data.run.id;
        userState.runs.add(runId);
        testState.activeRuns.add(runId);
        userState.idempotencyTokens.add(clientToken);
        testState.idempotencyTokens.add(clientToken);
      } else if (createResponse.statusCode === 200 && createResponse.data.idempotent) {
        testState.successfulRequests++;
        testState.idempotentHits++;
      } else if (createResponse.statusCode === 429) {
        testState.rateLimitHits++;
      } else {
        testState.failedRequests++;
        testState.errors.push(`User ${userId} create run failed: ${createResponse.statusCode}`);
      }

      // Start run if created successfully
      if (createResponse.statusCode === 201) {
        const runId = createResponse.data.run.id;
        testState.totalRequests++;
        const startResponse = await makeRequest('POST', `${CONFIG.GATEWAY_BASE_URL}/api/runs/${runId}/start`, null, { 'X-User-ID': userId });
        
        if (startResponse.statusCode === 200) {
          testState.successfulRequests++;
          
          // Connect SSE
          if (userState.sseConnections.size < CONFIG.SSE_CONNECTIONS_PER_USER) {
            testState.totalSSEConnections++;
            testState.activeSSEConnections++;
            
            connectSSE(`${CONFIG.GATEWAY_BASE_URL}/api/runs/${runId}/logs/stream`, userId)
              .then(() => {
                testState.activeSSEConnections--;
              })
              .catch((error) => {
                testState.activeSSEConnections--;
                testState.errors.push(`User ${userId} SSE failed: ${error.message}`);
              });
            
            userState.sseConnections.add(runId);
          }

          // Randomly cancel some runs
          if (Math.random() < CONFIG.CANCEL_RATE) {
            setTimeout(async () => {
              testState.totalRequests++;
              const cancelResponse = await makeRequest('POST', `${CONFIG.GATEWAY_BASE_URL}/api/runs/${runId}/cancel`, null, { 'X-User-ID': userId });
              
              if (cancelResponse.statusCode === 202) {
                testState.successfulRequests++;
                testState.cancelledRuns++;
                testState.activeRuns.delete(runId);
                userState.runs.delete(runId);
              } else {
                testState.failedRequests++;
                testState.errors.push(`User ${userId} cancel run failed: ${cancelResponse.statusCode}`);
              }
            }, Math.random() * 10000); // Cancel within 10 seconds
          }
        } else {
          testState.failedRequests++;
          testState.errors.push(`User ${userId} start run failed: ${startResponse.statusCode}`);
        }
      }

    } catch (error) {
      testState.failedRequests++;
      testState.errors.push(`User ${userId} error: ${error.message}`);
    }
  }, 1000 / CONFIG.REQUESTS_PER_USER_PER_SEC); // Convert to milliseconds

  return interval;
};

// Main test execution
const runStressTest = async () => {
  try {
    console.log('🚀 Starting 1-hour stress test...\n');

    // Start user simulations
    const userIntervals = [];
    for (let i = 1; i <= CONFIG.CONCURRENT_USERS; i++) {
      const interval = await simulateUser(`user-${i}`);
      userIntervals.push(interval);
    }

    // Start metrics collection
    const metricsInterval = setInterval(async () => {
      await collectMetrics();
      logStatus();
    }, CONFIG.METRICS_INTERVAL_MS);

    // Start artifact collection
    const artifactInterval = setInterval(() => {
      saveArtifact('checkpoint', {
        message: 'Regular checkpoint during stress test'
      });
    }, CONFIG.ARTIFACT_INTERVAL_MS);

    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, CONFIG.TEST_DURATION_MS));

    // Cleanup intervals
    userIntervals.forEach(clearInterval);
    clearInterval(metricsInterval);
    clearInterval(artifactInterval);

    // Final metrics collection
    const finalMetrics = await collectMetrics();
    testState.endTime = Date.now();

    // Generate final report
    const duration = testState.endTime - testState.startTime;
    const requestsPerSecond = testState.totalRequests / (duration / 1000);
    const successRate = testState.totalRequests > 0 ? 
      (testState.successfulRequests / testState.totalRequests) * 100 : 0;
    const errorRate = testState.totalRequests > 0 ? 
      (testState.failedRequests / testState.totalRequests) * 100 : 0;

    console.log('\n' + '='.repeat(60));
    console.log('🔥 1-HOUR STRESS TEST COMPLETED');
    console.log('='.repeat(60));
    console.log(`⏱️  Duration: ${Math.floor(duration / 1000 / 60)}m ${Math.floor((duration / 1000) % 60)}s`);
    console.log(`📊 Total Requests: ${testState.totalRequests}`);
    console.log(`✅ Successful: ${testState.successfulRequests} (${successRate.toFixed(1)}%)`);
    console.log(`❌ Failed: ${testState.failedRequests} (${errorRate.toFixed(1)}%)`);
    console.log(`📈 Requests/Second: ${requestsPerSecond.toFixed(2)}`);
    console.log(`🔗 Total SSE Connections: ${testState.totalSSEConnections}`);
    console.log(`🏃 Total Runs Created: ${testState.totalRuns}`);
    console.log(`❌ Runs Cancelled: ${testState.cancelledRuns}`);
    console.log(`🔄 Idempotency Hits: ${testState.idempotentHits}`);
    console.log(`⚡ Rate Limit Hits: ${testState.rateLimitHits}`);
    console.log(`📊 Metrics Collected: ${testState.metrics.length}`);
    console.log(`📁 Artifacts Saved: ${testState.artifacts.length}`);
    console.log(`💥 Total Errors: ${testState.errors.length}`);

    if (testState.errors.length > 0) {
      console.log('\n❌ Top 10 Errors:');
      const errorCounts = {};
      testState.errors.forEach(error => {
        errorCounts[error] = (errorCounts[error] || 0) + 1;
      });
      Object.entries(errorCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .forEach(([error, count]) => {
          console.log(`  ${count}x: ${error}`);
        });
    }

    // Final artifact
    const finalArtifact = {
      testConfig: CONFIG,
      testResults: {
        duration,
        totalRequests: testState.totalRequests,
        successfulRequests: testState.successfulRequests,
        failedRequests: testState.failedRequests,
        requestsPerSecond,
        successRate,
        errorRate,
        totalSSEConnections: testState.totalSSEConnections,
        totalRuns: testState.totalRuns,
        cancelledRuns: testState.cancelledRuns,
        idempotentHits: testState.idempotentHits,
        rateLimitHits: testState.rateLimitHits,
        totalErrors: testState.errors.length
      },
      metrics: testState.metrics,
      errors: testState.errors.slice(0, 100), // Limit to first 100 errors
      finalMetrics: finalMetrics
    };

    saveArtifact('final-report', finalArtifact);

    // Save complete results
    const resultsDir = 'artifacts/stress-test-1hr';
    fs.writeFileSync(`${resultsDir}/complete-results.json`, JSON.stringify(finalArtifact, null, 2));
    fs.writeFileSync(`${resultsDir}/all-errors.json`, JSON.stringify(testState.errors, null, 2));

    console.log('\n📁 Results saved to: artifacts/stress-test-1hr/');
    console.log(`📊 Overall Result: ${errorRate < 5 ? '✅ PASSED' : '❌ FAILED'} (Error rate: ${errorRate.toFixed(1)}%)`);

    process.exit(errorRate < 5 ? 0 : 1);

  } catch (error) {
    console.error('\n💥 Stress test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Stress test interrupted by user');
  testState.endTime = Date.now();
  saveArtifact('interrupted', { message: 'Test interrupted by user' });
  process.exit(0);
});

// Start the test
runStressTest();
