#!/usr/bin/env node

const http = require('http');

async function testGatewayConnection() {
  console.log('🔍 Testing gateway connection for S2 test...');
  
  try {
    const response = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/ready',
        method: 'GET',
        timeout: 5000
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body
          });
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));
      req.end();
    });
    
    console.log('✅ Gateway responded:', response.status);
    
    if (response.status === 200) {
      console.log('🎉 Gateway is ready! S2 test should work now.');
      console.log('💡 Run: node s2-long-haul-soak-short.js');
    }
    
  } catch (error) {
    console.log('❌ Gateway connection failed:', error.message);
    console.log('💡 Make sure gateway is running: node registry-gateway-enhanced.js');
  }
}

testGatewayConnection();
