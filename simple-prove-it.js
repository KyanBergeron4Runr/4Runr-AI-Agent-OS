const http = require('http');

console.log('🧪 Running Simple Prove-It Test...\n');

const BASE_URL = 'http://localhost:3000';

// Test functions
const testHealth = () => {
  return new Promise((resolve) => {
    const req = http.request(`${BASE_URL}/health`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.ok) {
            console.log('✅ Health check passed');
            resolve(true);
          } else {
            console.log('❌ Health check failed');
            resolve(false);
          }
        } catch (err) {
          console.log('❌ Health check failed - invalid JSON');
          resolve(false);
        }
      });
    });
    
    req.on('error', () => {
      console.log('❌ Health check failed - connection error');
      resolve(false);
    });
    
    req.end();
  });
};

const testReadiness = () => {
  return new Promise((resolve) => {
    const req = http.request(`${BASE_URL}/ready`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.ready) {
            console.log('✅ Readiness check passed');
            resolve(true);
          } else {
            console.log('❌ Readiness check failed');
            resolve(false);
          }
        } catch (err) {
          console.log('❌ Readiness check failed - invalid JSON');
          resolve(false);
        }
      });
    });
    
    req.on('error', () => {
      console.log('❌ Readiness check failed - connection error');
      resolve(false);
    });
    
    req.end();
  });
};

const testDemoRun = () => {
  return new Promise((resolve) => {
    const postData = JSON.stringify({});
    
    const req = http.request(`${BASE_URL}/api/diagnostics/emit-demo-run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.success && result.runId) {
            console.log('✅ Demo run created successfully');
            resolve(result.runId);
          } else {
            console.log('❌ Demo run failed');
            resolve(null);
          }
        } catch (err) {
          console.log('❌ Demo run failed - invalid JSON');
          resolve(null);
        }
      });
    });
    
    req.on('error', () => {
      console.log('❌ Demo run failed - connection error');
      resolve(null);
    });
    
    req.write(postData);
    req.end();
  });
};

const testMetrics = () => {
  return new Promise((resolve) => {
    const req = http.request(`${BASE_URL}/metrics`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (data.includes('sentinel_spans_total') && data.includes('sentinel_guard_events_total')) {
          console.log('✅ Metrics endpoint working');
          resolve(true);
        } else {
          console.log('❌ Metrics endpoint missing expected data');
          resolve(false);
        }
      });
    });
    
    req.on('error', () => {
      console.log('❌ Metrics check failed - connection error');
      resolve(false);
    });
    
    req.end();
  });
};

const testSSE = () => {
  return new Promise((resolve) => {
    const req = http.request(`${BASE_URL}/diagnostics/sse-test`, (res) => {
      if (res.headers['content-type'] && res.headers['content-type'].includes('text/event-stream')) {
        console.log('✅ SSE endpoint responding correctly');
        
        let eventCount = 0;
        res.on('data', (chunk) => {
          const data = chunk.toString();
          if (data.includes('data: ')) {
            eventCount++;
            if (eventCount >= 2) {
              console.log('✅ SSE events received');
              req.destroy();
              resolve(true);
            }
          }
        });
        
        // Timeout after 10 seconds
        setTimeout(() => {
          if (eventCount < 2) {
            console.log('❌ SSE test timeout');
            req.destroy();
            resolve(false);
          }
        }, 10000);
      } else {
        console.log('❌ SSE endpoint not responding with correct content type');
        resolve(false);
      }
    });
    
    req.on('error', () => {
      console.log('❌ SSE test failed - connection error');
      resolve(false);
    });
    
    req.end();
  });
};

// Run all tests
const runProveItTest = async () => {
  console.log('1. Testing health endpoint...');
  const healthOk = await testHealth();
  
  console.log('\n2. Testing readiness endpoint...');
  const readyOk = await testReadiness();
  
  console.log('\n3. Creating demo run...');
  const runId = await testDemoRun();
  
  console.log('\n4. Testing metrics endpoint...');
  const metricsOk = await testMetrics();
  
  console.log('\n5. Testing SSE endpoint...');
  const sseOk = await testSSE();
  
  console.log('\n📊 Prove-It Test Results:');
  console.log(`   Health: ${healthOk ? '✅' : '❌'}`);
  console.log(`   Readiness: ${readyOk ? '✅' : '❌'}`);
  console.log(`   Demo Run: ${runId ? '✅' : '❌'}`);
  console.log(`   Metrics: ${metricsOk ? '✅' : '❌'}`);
  console.log(`   SSE: ${sseOk ? '✅' : '❌'}`);
  
  if (healthOk && readyOk && runId && metricsOk && sseOk) {
    console.log('\n🎉 Prove-It Test PASSED!');
    console.log('\n✅ Basic 4Runr Gateway setup is working correctly');
    console.log('✅ All core endpoints are functional');
    console.log('✅ Demo run creation works');
    console.log('✅ Metrics are being collected');
    console.log('✅ SSE streaming is working');
    console.log('\n🚀 Ready for development and testing!');
  } else {
    console.log('\n⚠️  Prove-It Test FAILED');
    console.log('Some components need attention');
  }
};

runProveItTest().catch(console.error);
