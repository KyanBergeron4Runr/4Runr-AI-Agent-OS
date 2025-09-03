#!/usr/bin/env node

const http = require('http');

async function checkGateway() {
  console.log('🔍 Checking gateway status...');
  
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
            body: body
          });
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));
      req.end();
    });
    
    console.log('✅ Gateway status:', response.status);
    console.log('📄 Response:', response.body);
    
    // Check metrics
    const metricsResponse = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/metrics',
        method: 'GET',
        timeout: 5000
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            body: body
          });
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));
      req.end();
    });
    
    console.log('📊 Metrics status:', metricsResponse.status);
    console.log('📈 Metrics preview:', metricsResponse.body.substring(0, 200) + '...');
    
  } catch (error) {
    console.log('❌ Gateway check failed:', error.message);
  }
}

checkGateway();
