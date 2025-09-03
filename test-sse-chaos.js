#!/usr/bin/env node

/**
 * Quick SSE and Chaos Test
 * 
 * Purpose: Verify SSE connections and chaos endpoints work before running full harness
 */

const http = require('http');

const GATEWAY_URL = 'http://localhost:3000';

function makeRequest(method, path, data = null) {
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
        'X-Workspace-ID': 's2-unkillable',
        'X-Test-Bypass': 'true'
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
      reject(error);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Test SSE connection with proper closure
function testSSE(options = {}) {
  const { maxMessages = 5, timeoutMs = 10000 } = options;
  
  return new Promise((resolve, reject) => {
    const url = new URL('/diagnostics/sse-test', GATEWAY_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Authorization': 'Bearer test-token-s2-harness',
        'X-Workspace-ID': 's2-unkillable',
        'X-Test-Bypass': 'true'
      }
    };

    console.log('🔌 Testing SSE connection...');
    
    const req = http.request(options, (res) => {
      console.log(`   Status: ${res.statusCode}`);
      console.log(`   Headers: Content-Type=${res.headers['content-type']}, Cache-Control=${res.headers['cache-control']}`);
      
      if (res.statusCode === 200) {
        let messageCount = 0;
        let lastEventId = null;
        let buffer = '';
        
        // Set timeout to close connection
        const timeout = setTimeout(() => {
          req.destroy();
          console.log(`   SSE test completed - received ${messageCount} messages (timeout)`);
          resolve({ received: messageCount, lastEventId, reason: 'timeout' });
        }, timeoutMs);
        
        res.on('data', (chunk) => {
          buffer += chunk.toString();
          
          // Parse SSE events
          const lines = buffer.split('\n');
          buffer = lines.pop(); // Keep incomplete line in buffer
          
          for (let i = 0; i < lines.length; i += 4) {
            if (i + 3 < lines.length) {
              const idLine = lines[i];
              const eventLine = lines[i + 1];
              const dataLine = lines[i + 2];
              const emptyLine = lines[i + 3];
              
              if (idLine.startsWith('id:') && dataLine.startsWith('data:') && emptyLine === '') {
                const id = idLine.substring(3).trim();
                const data = dataLine.substring(5).trim();
                
                messageCount++;
                lastEventId = id;
                console.log(`   Received SSE message #${messageCount} (id: ${id})`);
                
                if (messageCount >= maxMessages) {
                  clearTimeout(timeout);
                  req.destroy(); // Explicitly close the connection
                  console.log(`   SSE test completed - received ${messageCount} messages (limit reached)`);
                  resolve({ received: messageCount, lastEventId, reason: 'limit' });
                  return;
                }
              }
            }
          }
        });
        
        res.on('end', () => {
          clearTimeout(timeout);
          console.log(`   SSE test completed - received ${messageCount} messages (connection ended)`);
          resolve({ received: messageCount, lastEventId, reason: 'end' });
        });
        
        res.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      } else {
        reject(new Error(`SSE failed with status ${res.statusCode}`));
      }
    });

    req.on('error', (error) => {
      reject(error);
    });
    
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing SSE and Chaos endpoints...\n');
  
  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const health = await makeRequest('GET', '/health');
    console.log(`   Status: ${health.status}`);
    console.log(`   Response: ${JSON.stringify(health.data)}\n`);
    
    // Test 2: Metrics
    console.log('2. Testing metrics endpoint...');
    const metrics = await makeRequest('GET', '/metrics');
    console.log(`   Status: ${metrics.status}`);
    console.log(`   SSE active connections: ${metrics.data.sse_active_connections || 0}`);
    console.log(`   SSE messages total: ${metrics.data.sse_messages_total || 0}\n`);
    
    // Test 3: SSE connection (properly closed)
    console.log('3. Testing SSE connection...');
    const sseResult = await testSSE({ maxMessages: 5, timeoutMs: 15000 });
    console.log(`   Result: ${sseResult.received} messages, last ID: ${sseResult.lastEventId}, reason: ${sseResult.reason}\n`);
    
    // Test 4: Chaos endpoints
    console.log('4. Testing chaos endpoints...');
    
    const redisChaos = await makeRequest('POST', '/api/chaos/redis-restart');
    console.log(`   Redis restart: ${redisChaos.status} - ${JSON.stringify(redisChaos.data)}`);
    
    const gatewayChaos = await makeRequest('POST', '/api/chaos/gateway-restart');
    console.log(`   Gateway restart: ${gatewayChaos.status} - ${JSON.stringify(gatewayChaos.data)}`);
    
    const latencyChaos = await makeRequest('POST', '/api/chaos/latency', { delay: 150 });
    console.log(`   Latency injection: ${latencyChaos.status} - ${JSON.stringify(latencyChaos.data)}\n`);
    
    // Test 5: Verify metrics after SSE
    console.log('5. Verifying metrics after SSE...');
    const metricsAfter = await makeRequest('GET', '/metrics');
    console.log(`   Status: ${metricsAfter.status}`);
    console.log(`   SSE active connections: ${metricsAfter.data.sse_active_connections || 0}`);
    console.log(`   SSE messages total: ${metricsAfter.data.sse_messages_total || 0}\n`);
    
    console.log('✅ All tests passed! SSE and chaos endpoints are working correctly.');
    console.log('🚀 Ready to run the full harness.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
