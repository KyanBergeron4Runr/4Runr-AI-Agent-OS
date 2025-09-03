#!/usr/bin/env node

const http = require('http');

console.log('🧪 Simple SSE Test...\n');

// Test 1: Check metrics before SSE
console.log('1. Metrics before SSE:');
http.get('http://localhost:3000/metrics', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const metrics = JSON.parse(data);
    console.log(`   SSE active: ${metrics.sse_active_connections}`);
    console.log(`   SSE messages: ${metrics.sse_messages_total}`);
    console.log(`   SSE connections: ${metrics.sse_connections_total}\n`);
    
    // Test 2: Open SSE connection
    console.log('2. Opening SSE connection...');
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/diagnostics/sse-test',
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    }, (res) => {
      console.log(`   Status: ${res.statusCode}`);
      console.log(`   Content-Type: ${res.headers['content-type']}`);
      
      let messageCount = 0;
      res.on('data', (chunk) => {
        const data = chunk.toString();
        if (data.includes('data:')) {
          messageCount++;
          console.log(`   Received message #${messageCount}`);
          
          if (messageCount >= 3) {
            req.destroy(); // Close connection after 3 messages
            console.log('   SSE connection closed\n');
            
            // Test 3: Check metrics after SSE
            setTimeout(() => {
              console.log('3. Metrics after SSE:');
              http.get('http://localhost:3000/metrics', (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                  const metrics = JSON.parse(data);
                  console.log(`   SSE active: ${metrics.sse_active_connections}`);
                  console.log(`   SSE messages: ${metrics.sse_messages_total}`);
                  console.log(`   SSE connections: ${metrics.sse_connections_total}\n`);
                  
                  console.log('✅ SSE test completed!');
                  console.log('📊 Expected: active=0, messages>0, connections>0');
                });
              });
            }, 1000);
          }
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('   SSE Error:', error.message);
    });
    
    req.end();
  });
});
