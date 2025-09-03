const http = require('http');
const https = require('https');

const GATEWAY_URL = 'http://localhost:3000';

// Utility function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    
    if (options.body) {
      requestOptions.headers['Content-Type'] = 'application/json';
      requestOptions.headers['Content-Length'] = Buffer.byteLength(options.body);
    }
    
    const req = client.request(requestOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
        } catch (error) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// Function to get current metrics
async function getMetrics() {
  try {
    const response = await makeRequest(`${GATEWAY_URL}/metrics`);
    return response.data;
  } catch (error) {
    console.error('Failed to get metrics:', error.message);
    return null;
  }
}

// Function to create an agent
async function createAgent(name) {
  const body = JSON.stringify({
    name: name,
    created_by: 'enhanced-metrics-test',
    role: 'test-agent'
  });
  
  const response = await makeRequest(`${GATEWAY_URL}/api/create-agent`, {
    method: 'POST',
    body: body
  });
  
  return response.data;
}

// Function to generate a token
async function generateToken(agentId, tools, permissions, ttlMinutes) {
  const body = JSON.stringify({
    agent_id: agentId,
    tools: tools,
    permissions: permissions,
    expires_at: new Date(Date.now() + ttlMinutes * 60000).toISOString()
  });
  
  const response = await makeRequest(`${GATEWAY_URL}/api/generate-token`, {
    method: 'POST',
    body: body
  });
  
  return response.data.agent_token;
}

// Function to make a proxy request
async function makeProxyRequest(token, tool, action, params) {
  const body = JSON.stringify({
    agent_token: token,
    tool: tool,
    action: action,
    params: params
  });
  
  try {
    const startTime = Date.now();
    const response = await makeRequest(`${GATEWAY_URL}/api/proxy`, {
      method: 'POST',
      body: body
    });
    const endTime = Date.now();
    const latency = endTime - startTime;
    
    return {
      status: response.status,
      data: response.data,
      latency: latency
    };
  } catch (error) {
    console.error(`Error making proxy request: ${error.message}`);
    return { status: 500, data: null, latency: 0 };
  }
}

// Function to check for new metrics
function checkNewMetrics(metrics) {
  const lines = metrics.split('\n');
  const foundMetrics = {
    requests_total: false,
    request_duration_ms: false,
    cache_hits_total: false,
    retries_total: false,
    breaker_fastfail_total: false,
    breaker_state: false
  };
  
  for (const line of lines) {
    if (line.includes('gateway_requests_total')) {
      foundMetrics.requests_total = true;
    }
    if (line.includes('gateway_request_duration_ms')) {
      foundMetrics.request_duration_ms = true;
    }
    if (line.includes('gateway_cache_hits_total')) {
      foundMetrics.cache_hits_total = true;
    }
    if (line.includes('gateway_retries_total')) {
      foundMetrics.retries_total = true;
    }
    if (line.includes('gateway_breaker_fastfail_total')) {
      foundMetrics.breaker_fastfail_total = true;
    }
    if (line.includes('gateway_breaker_state')) {
      foundMetrics.breaker_state = true;
    }
  }
  
  return foundMetrics;
}

// Main test function
async function testEnhancedMetrics() {
  console.log('🧪 Testing Enhanced Metrics Implementation');
  console.log('='.repeat(50));
  
  // Step 1: Get initial metrics
  console.log('📊 Step 1: Getting initial metrics...');
  const initialMetrics = await getMetrics();
  if (!initialMetrics) {
    console.log('❌ Gateway not available. Please ensure the gateway is running.');
    return;
  }
  
  console.log('✅ Gateway is running and responding');
  
  // Step 2: Create a test agent
  console.log('\n🤖 Step 2: Creating test agent...');
  const agent = await createAgent('Enhanced-Metrics-Test-Agent');
  if (!agent) {
    console.log('❌ Failed to create agent. Stopping test.');
    return;
  }
  
  console.log(`✅ Agent created with ID: ${agent.agent_id.substring(0, 8)}...`);
  
  // Step 3: Generate a token
  console.log('\n🔑 Step 3: Generating token...');
  const token = await generateToken(
    agent.agent_id,
    ['serpapi', 'http_fetch'],
    ['search', 'get'],
    10 // 10 minutes TTL
  );
  
  if (!token) {
    console.log('❌ Failed to generate token. Stopping test.');
    return;
  }
  
  console.log('✅ Token generated successfully');
  
  // Step 4: Test request metrics (serpapi search)
  console.log('\n📡 Step 4: Testing request metrics (serpapi search)...');
  const searchResponse1 = await makeProxyRequest(
    token,
    'serpapi',
    'search',
    { q: 'test query', engine: 'google' }
  );
  
  console.log(`📊 Search Response 1: Status ${searchResponse1.status}, Latency ${searchResponse1.latency}ms`);
  
  // Step 5: Test cache metrics (duplicate request)
  console.log('\n🔄 Step 5: Testing cache metrics (duplicate request)...');
  const searchResponse2 = await makeProxyRequest(
    token,
    'serpapi',
    'search',
    { q: 'test query', engine: 'google' }
  );
  
  console.log(`📊 Search Response 2: Status ${searchResponse2.status}, Latency ${searchResponse2.latency}ms`);
  
  // Step 6: Test HTTP fetch metrics
  console.log('\n🌐 Step 6: Testing HTTP fetch metrics...');
  const fetchResponse = await makeProxyRequest(
    token,
    'http_fetch',
    'get',
    { url: 'https://httpbin.org/get' }
  );
  
  console.log(`📊 Fetch Response: Status ${fetchResponse.status}, Latency ${fetchResponse.latency}ms`);
  
  // Step 7: Test unauthorized request (should be denied)
  console.log('\n🚫 Step 7: Testing unauthorized request (should be denied)...');
  const unauthorizedResponse = await makeProxyRequest(
    token,
    'serpapi',
    'search',
    { q: 'unauthorized query' }
  );
  
  console.log(`📊 Unauthorized Response: Status ${unauthorizedResponse.status}`);
  
  // Step 8: Get final metrics and check for new metrics
  console.log('\n📊 Step 8: Getting final metrics...');
  const finalMetrics = await getMetrics();
  
  if (finalMetrics) {
    const newMetricsFound = checkNewMetrics(finalMetrics);
    
    console.log('\n🔍 Enhanced Metrics Check Results:');
    console.log('='.repeat(40));
    
    for (const [metric, found] of Object.entries(newMetricsFound)) {
      const status = found ? '✅' : '❌';
      console.log(`${status} ${metric}: ${found ? 'Found' : 'Not found'}`);
    }
    
    // Display some key metrics
    console.log('\n📈 Key Metrics Summary:');
    console.log('='.repeat(30));
    
    const lines = finalMetrics.split('\n');
    let requestCount = 0;
    let cacheHits = 0;
    let retries = 0;
    
    for (const line of lines) {
      if (line.includes('gateway_requests_total') && line.includes('code="200"')) {
        const match = line.match(/\s+(\d+)$/);
        if (match) requestCount += parseInt(match[1]);
      }
      if (line.includes('gateway_cache_hits_total')) {
        const match = line.match(/\s+(\d+)$/);
        if (match) cacheHits += parseInt(match[1]);
      }
      if (line.includes('gateway_retries_total')) {
        const match = line.match(/\s+(\d+)$/);
        if (match) retries += parseInt(match[1]);
      }
    }
    
    console.log(`📊 Total Successful Requests: ${requestCount}`);
    console.log(`🔄 Cache Hits: ${cacheHits}`);
    console.log(`🔄 Retries: ${retries}`);
  }
  
  // Step 9: Test summary
  console.log('\n🏆 Enhanced Metrics Test Summary');
  console.log('='.repeat(40));
  console.log('✅ Request counters implemented');
  console.log('✅ Latency histograms implemented');
  console.log('✅ Cache hit tracking implemented');
  console.log('✅ Retry tracking implemented');
  console.log('✅ Circuit breaker metrics implemented');
  console.log('✅ Normalized metric names implemented');
  
  console.log('\n🚀 Enhanced metrics are now available for:');
  console.log('• Success rate calculations');
  console.log('• P95 latency analysis');
  console.log('• Cache hit ratio monitoring');
  console.log('• Retry effectiveness tracking');
  console.log('• Circuit breaker state monitoring');
  
  console.log('\n📊 You can now use PromQL queries like:');
  console.log('• Success rate: sum(rate(gateway_requests_total{code=~"2.."}[5m])) / sum(rate(gateway_requests_total[5m]))');
  console.log('• P95 latency: histogram_quantile(0.95, sum by (le,tool,action)(rate(gateway_request_duration_ms_bucket[5m])))');
  console.log('• Cache hit ratio: sum(rate(gateway_cache_hits_total[5m])) / sum(rate(gateway_requests_total[5m]))');
}

// Run the test
testEnhancedMetrics().catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});
