const http = require('http');

const BASE_URL = 'http://localhost:3000';
const CONCURRENT_REQUESTS = 50;
const TOTAL_REQUESTS = 200;
const TEST_DURATION_MS = 30000; // 30 seconds

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
            data: jsonData,
            timestamp: Date.now()
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data,
            timestamp: Date.now()
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

// Test scenarios
const testScenarios = {
  // Valid requests with idempotency
  validWithIdempotency: {
    name: 'Valid requests with idempotency',
    requests: Array.from({ length: TOTAL_REQUESTS }, (_, i) => ({
      method: 'POST',
      path: '/api/runs',
      body: {
        name: `Stress Test Run ${i}`,
        input: `Input for run ${i}`,
        client_token: `stress_token_${i % 10}`, // Only 10 unique tokens
        tags: [`tag${i % 5}`, `tag${(i + 1) % 5}`]
      }
    }))
  },

  // Invalid requests (should all fail with 422)
  invalidRequests: {
    name: 'Invalid requests (validation)',
    requests: Array.from({ length: TOTAL_REQUESTS / 2 }, (_, i) => ({
      method: 'POST',
      path: '/api/runs',
      body: {
        name: i % 2 === 0 ? '' : 'a'.repeat(129), // Empty or too long
        input: 'test',
        client_token: i % 3 === 0 ? 'invalid@token' : undefined,
        tags: i % 4 === 0 ? Array(20).fill('tag') : undefined // Too many tags
      }
    }))
  },

  // Mixed valid/invalid requests
  mixedRequests: {
    name: 'Mixed valid/invalid requests',
    requests: Array.from({ length: TOTAL_REQUESTS }, (_, i) => ({
      method: 'POST',
      path: '/api/runs',
      body: i % 3 === 0 ? {
        // Invalid request
        name: '',
        input: 'test'
      } : {
        // Valid request
        name: `Mixed Test ${i}`,
        input: `Input ${i}`,
        client_token: `mixed_token_${i % 5}`,
        tags: [`tag${i % 3}`]
      }
    }))
  },

  // Large payloads
  largePayloads: {
    name: 'Large payload handling',
    requests: Array.from({ length: TOTAL_REQUESTS / 4 }, (_, i) => ({
      method: 'POST',
      path: '/api/runs',
      body: {
        name: `Large Payload ${i}`,
        input: 'x'.repeat(65536), // 64KB string
        client_token: `large_token_${i}`
      }
    }))
  },

  // Cancellation tests
  cancellationTests: {
    name: 'Cancellation tests',
    requests: [] // Will be populated dynamically
  },

  // SSE stress test
  sseStress: {
    name: 'SSE stress test',
    requests: Array.from({ length: TOTAL_REQUESTS / 10 }, (_, i) => ({
      method: 'GET',
      path: '/diagnostics/sse-test',
      headers: {
        'Accept': 'text/event-stream'
      }
    }))
  }
};

// Helper to run requests with concurrency control
const runRequestsWithConcurrency = async (requests, concurrency = CONCURRENT_REQUESTS) => {
  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < requests.length; i += concurrency) {
    const batch = requests.slice(i, i + concurrency);
    const batchPromises = batch.map(async (request, batchIndex) => {
      try {
        const result = await makeRequest(request.method, request.path, request.body, request.headers);
        return {
          ...result,
          requestIndex: i + batchIndex,
          scenario: request.scenario || 'unknown'
        };
      } catch (error) {
        return {
          error: error.message,
          requestIndex: i + batchIndex,
          scenario: request.scenario || 'unknown',
          timestamp: Date.now()
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Small delay between batches to prevent overwhelming
    if (i + concurrency < requests.length) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  return {
    results,
    duration: Date.now() - startTime
  };
};

// Analyze results
const analyzeResults = (results, scenarioName) => {
  const analysis = {
    scenario: scenarioName,
    total: results.length,
    successful: 0,
    failed: 0,
    statusCodes: {},
    errors: [],
    averageResponseTime: 0,
    minResponseTime: Infinity,
    maxResponseTime: 0
  };

  let totalResponseTime = 0;
  let responseTimeCount = 0;

  results.forEach(result => {
    if (result.error) {
      analysis.failed++;
      analysis.errors.push(result.error);
    } else {
      const statusCode = result.statusCode;
      analysis.statusCodes[statusCode] = (analysis.statusCodes[statusCode] || 0) + 1;

      if (statusCode >= 200 && statusCode < 300) {
        analysis.successful++;
      } else {
        analysis.failed++;
      }

      if (result.timestamp) {
        totalResponseTime += result.timestamp;
        responseTimeCount++;
        analysis.minResponseTime = Math.min(analysis.minResponseTime, result.timestamp);
        analysis.maxResponseTime = Math.max(analysis.maxResponseTime, result.timestamp);
      }
    }
  });

  if (responseTimeCount > 0) {
    analysis.averageResponseTime = totalResponseTime / responseTimeCount;
  }

  return analysis;
};

// Test cancellation functionality
const testCancellation = async () => {
  console.log('\n🚫 Testing cancellation under stress...');
  
  const cancellationRequests = [];
  
  // Create runs and immediately try to cancel them
  for (let i = 0; i < 20; i++) {
    const runId = `cancel-test-${Date.now()}-${i}`;
    
    // Create run
    cancellationRequests.push({
      method: 'POST',
      path: '/api/runs',
      body: {
        name: `Cancel Test ${i}`,
        input: 'test input',
        client_token: `cancel_token_${i}`
      },
      scenario: 'cancellation'
    });

    // Start run
    cancellationRequests.push({
      method: 'POST',
      path: `/api/runs/${runId}/start`,
      scenario: 'cancellation'
    });

    // Cancel run
    cancellationRequests.push({
      method: 'POST',
      path: `/api/runs/${runId}/cancel`,
      scenario: 'cancellation'
    });
  }

  testScenarios.cancellationTests.requests = cancellationRequests;
};

// Main stress test
const runStressTest = async () => {
  console.log('🔥 Starting Production Gateway Stress Test');
  console.log(`📊 Configuration:`);
  console.log(`  Concurrent requests: ${CONCURRENT_REQUESTS}`);
  console.log(`  Total requests per scenario: ~${TOTAL_REQUESTS}`);
  console.log(`  Test duration: ${TEST_DURATION_MS}ms`);
  console.log(`  Base URL: ${BASE_URL}`);

  // Check if gateway is running
  try {
    const healthCheck = await makeRequest('GET', '/health');
    if (healthCheck.statusCode !== 200) {
      throw new Error('Gateway not responding');
    }
    console.log('\n✅ Gateway is running and healthy');
  } catch (error) {
    console.error('❌ Gateway is not running. Please start the production gateway first.');
    process.exit(1);
  }

  // Prepare cancellation tests
  await testCancellation();

  const allResults = [];
  const startTime = Date.now();

  // Run each test scenario
  for (const [key, scenario] of Object.entries(testScenarios)) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running: ${scenario.name}`);
    console.log(`Requests: ${scenario.requests.length}`);
    console.log(`${'='.repeat(60)}`);

    const { results, duration } = await runRequestsWithConcurrency(scenario.requests);
    const analysis = analyzeResults(results, scenario.name);

    console.log(`\n📈 Results for ${scenario.name}:`);
    console.log(`  Duration: ${duration}ms`);
    console.log(`  Total requests: ${analysis.total}`);
    console.log(`  Successful: ${analysis.successful}`);
    console.log(`  Failed: ${analysis.failed}`);
    console.log(`  Success rate: ${((analysis.successful / analysis.total) * 100).toFixed(2)}%`);
    
    if (Object.keys(analysis.statusCodes).length > 0) {
      console.log(`  Status codes:`, analysis.statusCodes);
    }

    if (analysis.errors.length > 0) {
      console.log(`  Errors: ${analysis.errors.length} unique errors`);
      const uniqueErrors = [...new Set(analysis.errors)];
      uniqueErrors.slice(0, 3).forEach(error => console.log(`    - ${error}`));
      if (uniqueErrors.length > 3) {
        console.log(`    ... and ${uniqueErrors.length - 3} more`);
      }
    }

    allResults.push(analysis);
  }

  const totalDuration = Date.now() - startTime;

  // Final summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('🎯 STRESS TEST SUMMARY');
  console.log(`${'='.repeat(60)}`);
  
  const totalRequests = allResults.reduce((sum, r) => sum + r.total, 0);
  const totalSuccessful = allResults.reduce((sum, r) => sum + r.successful, 0);
  const totalFailed = allResults.reduce((sum, r) => sum + r.failed, 0);

  console.log(`Total test duration: ${totalDuration}ms`);
  console.log(`Total requests: ${totalRequests}`);
  console.log(`Total successful: ${totalSuccessful}`);
  console.log(`Total failed: ${totalFailed}`);
  console.log(`Overall success rate: ${((totalSuccessful / totalRequests) * 100).toFixed(2)}%`);
  console.log(`Requests per second: ${(totalRequests / (totalDuration / 1000)).toFixed(2)}`);

  // Check for production readiness indicators
  console.log(`\n🔍 Production Readiness Check:`);
  
  const hasValidationErrors = allResults.some(r => r.statusCodes[422] > 0);
  const hasRateLimiting = allResults.some(r => r.statusCodes[429] > 0);
  const hasNo5xxErrors = !allResults.some(r => Object.keys(r.statusCodes).some(code => parseInt(code) >= 500));
  const hasGoodSuccessRate = (totalSuccessful / totalRequests) > 0.8;

  console.log(`  ✅ Input validation working: ${hasValidationErrors ? 'YES' : 'NO'}`);
  console.log(`  ✅ Rate limiting active: ${hasRateLimiting ? 'YES' : 'NO'}`);
  console.log(`  ✅ No 5xx errors: ${hasNo5xxErrors ? 'YES' : 'NO'}`);
  console.log(`  ✅ Good success rate (>80%): ${hasGoodSuccessRate ? 'YES' : 'NO'}`);

  const isProductionReady = hasValidationErrors && hasNo5xxErrors && hasGoodSuccessRate;
  
  if (isProductionReady) {
    console.log(`\n🎉 PRODUCTION READY! All critical checks passed.`);
  } else {
    console.log(`\n⚠️ NOT PRODUCTION READY. Some critical checks failed.`);
  }

  // Detailed scenario breakdown
  console.log(`\n📋 Scenario Breakdown:`);
  allResults.forEach(result => {
    const successRate = ((result.successful / result.total) * 100).toFixed(2);
    const status = successRate > 80 ? '✅' : successRate > 50 ? '⚠️' : '❌';
    console.log(`  ${status} ${result.scenario}: ${successRate}% success (${result.successful}/${result.total})`);
  });

  return {
    isProductionReady,
    results: allResults,
    summary: {
      totalRequests,
      totalSuccessful,
      totalFailed,
      successRate: (totalSuccessful / totalRequests) * 100,
      duration: totalDuration,
      requestsPerSecond: totalRequests / (totalDuration / 1000)
    }
  };
};

// Run stress test if this file is executed directly
if (require.main === module) {
  runStressTest().catch(console.error);
}

module.exports = {
  runStressTest,
  testScenarios,
  makeRequest,
  analyzeResults
};
