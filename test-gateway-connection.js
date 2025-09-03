#!/usr/bin/env node

const http = require('http');

async function testGatewayConnection() {
  console.log('🔍 Testing gateway connection...');
  
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
    console.log('📄 Response body:', response.body);
    
  } catch (error) {
    console.log('❌ Gateway connection failed:', error.message);
    console.log('💡 Error details:', error);
  }
}

testGatewayConnection();
