// Simple Sentinel/Shield Test - No Redis Required
const http = require('http');

console.log('🛡️ Testing Sentinel/Shield System (Simple Test)');
console.log('==============================================');

// Test 1: Health Check
async function testHealth() {
  console.log('\n1️⃣ Testing Health Check...');
  try {
    const response = await makeRequest('GET', '/api/health');
    if (response.statusCode === 200) {
      console.log('✅ Health check passed');
      return true;
    } else {
      console.log(`❌ Health check failed: ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Health check failed: ${error.message}`);
    return false;
  }
}

// Test 2: Sentinel Metrics
async function testSentinelMetrics() {
  console.log('\n2️⃣ Testing Sentinel Metrics...');
  try {
    const response = await makeRequest('GET', '/api/sentinel/metrics');
    if (response.statusCode === 200) {
      const metrics = JSON.parse(response.data);
      console.log('✅ Sentinel metrics working');
      console.log(`   - Total spans: ${metrics.totalSpans}`);
      console.log(`   - Total events: ${metrics.totalEvents}`);
      console.log(`   - Shield decisions: ${metrics.totalShieldDecisions}`);
      return true;
    } else {
      console.log(`❌ Sentinel metrics failed: ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Sentinel metrics failed: ${error.message}`);
    return false;
  }
}

// Test 3: Sentinel Config
async function testSentinelConfig() {
  console.log('\n3️⃣ Testing Sentinel Config...');
  try {
    const response = await makeRequest('GET', '/api/sentinel/config');
    if (response.statusCode === 200) {
      const config = JSON.parse(response.data);
      console.log('✅ Sentinel config working');
      console.log(`   - Shield enabled: ${config.shield?.enabled}`);
      console.log(`   - Shield mode: ${config.shield?.mode}`);
      return true;
    } else {
      console.log(`❌ Sentinel config failed: ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Sentinel config failed: ${error.message}`);
    return false;
  }
}

// Test 4: Sentinel Events Stream
async function testSentinelEvents() {
  console.log('\n4️⃣ Testing Sentinel Events Stream...');
  try {
    return new Promise((resolve) => {
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/sentinel/events/stream',
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        }
      };

      const req = http.request(options, (res) => {
        if (res.statusCode === 200) {
          console.log('✅ Sentinel events stream accessible');
          
          // Set a timeout to close the connection after receiving initial data
          const timeout = setTimeout(() => {
            req.destroy();
            resolve(true);
          }, 2000);

          res.on('data', (chunk) => {
            const data = chunk.toString();
            if (data.includes('data:') && data.includes('connection')) {
              console.log('   - Received initial connection message');
              clearTimeout(timeout);
              req.destroy();
              resolve(true);
            }
          });

          res.on('error', (error) => {
            clearTimeout(timeout);
            // Ignore connection aborted errors (expected when we destroy the connection)
            if (error.code !== 'ECONNRESET' && error.message !== 'aborted') {
              console.log(`❌ Events stream error: ${error.message}`);
            }
            resolve(false);
          });
        } else {
          console.log(`❌ Events stream failed: ${res.statusCode}`);
          resolve(false);
        }
      });

      req.on('error', (error) => {
        console.log(`❌ Events stream failed: ${error.message}`);
        resolve(false);
      });

      req.setTimeout(5000, () => {
        req.destroy();
        console.log('❌ Events stream timeout');
        resolve(false);
      });

      req.end();
    });
  } catch (error) {
    console.log(`❌ Events stream failed: ${error.message}`);
    return false;
  }
}

// Helper function to make HTTP requests
function makeRequest(method, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Main test function
async function runTests() {
  console.log('⏳ Waiting for server to be ready...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  const results = [];
  
  results.push(await testHealth());
  results.push(await testSentinelMetrics());
  results.push(await testSentinelConfig());
  results.push(await testSentinelEvents());

  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log('\n🎉 Test Results:');
  console.log('================');
  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}`);

  if (passed === total) {
    console.log('\n🎉 All tests passed! Sentinel/Shield system is working!');
  } else {
    console.log('\n⚠️ Some tests failed. Check server logs for details.');
  }
}

// Run the tests
runTests().catch(console.error);
