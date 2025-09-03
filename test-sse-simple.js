#!/usr/bin/env node

const http = require('http');

const makeRequest = (method, url, body = null) => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Content-Type': 'application/json'
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
            data: jsonData
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            data: null,
            rawData: data
          });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
};

const testSSE = async () => {
  try {
    console.log('🚀 Simple SSE Test Starting...\n');

    // Create a run
    const createResponse = await makeRequest('POST', 'http://localhost:3000/api/runs', {
      name: 'Simple SSE Test',
      input: 'test input',
      client_token: 'simple-sse-test-123',
      tags: ['simple', 'sse-test']
    });

    console.log('✅ Run created:', createResponse.data.run.id);
    const runId = createResponse.data.run.id;

    // Start the run
    const startResponse = await makeRequest('POST', `http://localhost:3000/api/runs/${runId}/start`);
    console.log('✅ Run started');

    // Connect to SSE
    console.log('🔌 Connecting to SSE stream...');
    
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3000,
        path: `/api/runs/${runId}/logs/stream`,
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream'
        }
      }, (res) => {
        console.log(`📡 SSE Response: ${res.statusCode}`);
        console.log(`📡 Headers:`, res.headers);
        
        let eventCount = 0;
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
                eventCount++;
                console.log(`📦 Event ${eventCount}:`, parsed);
                
                if (eventCount >= 2) {
                  console.log('✅ Received multiple events, SSE is working!');
                  req.destroy();
                  resolve();
                }
              } catch (e) {
                console.log('⚠️ Non-JSON event data:', eventData);
              }
            }
          }
        });
        
        res.on('end', () => {
          console.log('📡 SSE stream ended');
          if (eventCount === 0) {
            reject(new Error('No events received'));
          } else {
            resolve();
          }
        });
      });
      
      req.on('error', reject);
      req.end();
    });

  } catch (error) {
    console.error('💥 Test failed:', error.message);
    process.exit(1);
  }
};

testSSE().then(() => {
  console.log('🎉 Simple SSE test passed!');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Simple SSE test failed:', error.message);
  process.exit(1);
});
