const http = require('http');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const WORKSPACE_ID = 'sse-test-workspace-' + Date.now();

console.log('🧪 SSE De-duping Microtest');
console.log('==========================');
console.log(`Target: ${BASE_URL}`);
console.log(`Workspace: ${WORKSPACE_ID}`);

// Utility functions
function makeRequest(path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-Workspace-ID': WORKSPACE_ID,
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// SSE connection helper with event ID tracking
async function connectSSE(runId, streamType, duration = 5000, lastEventId = null) {
  return new Promise((resolve) => {
    const url = new URL(`/api/runs/${runId}/${streamType}/stream`, BASE_URL);
    let events = [];
    let buffer = '';
    let eventIds = new Set();
    
    const headers = {
      'X-Workspace-ID': WORKSPACE_ID,
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache'
    };
    
    if (lastEventId) {
      headers['Last-Event-ID'] = lastEventId;
    }
    
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
      headers: headers
    }, (res) => {
      res.on('data', (chunk) => {
        const chunkStr = chunk.toString();
        console.log(`📡 Raw SSE chunk: ${chunkStr.replace(/\n/g, '\\n')}`);
        
        buffer += chunkStr;
        const lines = buffer.split('\n');
        buffer = lines.pop();
        
        let currentEventId = null;
        let currentEventData = null;
        
        for (const line of lines) {
          if (line.startsWith('id: ')) {
            currentEventId = line.substring(4).trim();
            console.log(`📡 Event ID: ${currentEventId}`);
          } else if (line.startsWith('data: ')) {
            try {
              currentEventData = JSON.parse(line.substring(6));
              console.log(`📡 Event data: ${currentEventData.type || 'unknown'}`);
            } catch (e) {
              console.log(`⚠️  Malformed event data: ${line.substring(6)}`);
            }
          } else if (line.trim() === '') {
            // End of event
            if (currentEventData) {
              // Use the actual event ID from the server, or fallback to generated ID
              const eventId = currentEventId || currentEventData._event_id || `event-${events.length + 1}`;
              events.push({
                id: eventId,
                data: currentEventData
              });
              eventIds.add(eventId);
              console.log(`📡 Event stored: ${eventId}`);
            }
            currentEventId = null;
            currentEventData = null;
          }
        }
      });
      
      res.on('end', () => {
        resolve({ 
          success: res.statusCode === 200, 
          events,
          eventIds: Array.from(eventIds),
          uniqueCount: eventIds.size,
          totalCount: events.length
        });
      });
    });
    
    req.on('error', () => {
      resolve({ success: false, events: [], eventIds: [], uniqueCount: 0, totalCount: 0 });
    });
    
    setTimeout(() => {
      req.destroy();
      resolve({ 
        success: true, 
        events,
        eventIds: Array.from(eventIds),
        uniqueCount: eventIds.size,
        totalCount: events.length
      });
    }, duration);
    
    req.end();
  });
}

// Main test function
async function runSSEDedupingTest() {
  console.log('\n1. Starting test run...');
  
  // Get agents
  const agents = await makeRequest('/api/agents');
  if (agents.status !== 200 || !agents.data.length) {
    console.log('❌ No agents available');
    return false;
  }
  
  const agent = agents.data[0];
  console.log(`✅ Using agent: ${agent.name}`);
  
  // Start a run
  const run = await makeRequest(`/api/agents/${agent.slug}/run`, 'POST', {
    workspace_id: WORKSPACE_ID,
    input: { message: 'SSE de-duping test run' }
  });
  
  if (run.status !== 200 || !run.data.run_id) {
    console.log(`❌ Failed to start run: ${run.status}`);
    return false;
  }
  
  const runId = run.data.run_id;
  console.log(`✅ Run started: ${runId}`);
  
  // Connect to SSE immediately while run is starting
  console.log('\n2. Connecting to SSE during run...');
  const liveSSE = await connectSSE(runId, 'logs', 8000);
  
  if (!liveSSE.success) {
    console.log('❌ Live SSE connection failed');
    return false;
  }
  
  console.log(`✅ Live connection: ${liveSSE.totalCount} events, ${liveSSE.uniqueCount} unique`);
  
  // Wait for run to complete
  console.log('\n3. Waiting for run to complete...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Check run status
  const runStatus = await makeRequest(`/api/runs/${runId}`);
  console.log(`   Run status: ${runStatus.data?.status || 'unknown'}`);
  
  // Now test replay with Last-Event-ID
  console.log('\n4. Testing replay with Last-Event-ID...');
  const lastEvent = liveSSE.events.length > 0 ? liveSSE.events[liveSSE.events.length - 1] : null;
  const lastEventId = lastEvent ? lastEvent.data._event_id || lastEvent.id : null;
  console.log(`   Using Last-Event-ID: ${lastEventId}`);
  const replaySSE = await connectSSE(runId, 'logs', 3000, lastEventId);
  
  if (!replaySSE.success) {
    console.log('❌ Replay SSE connection failed');
    return false;
  }
  
  console.log(`✅ Replay connection: ${replaySSE.totalCount} events, ${replaySSE.uniqueCount} unique`);
  console.log(`   Last Event ID: ${lastEventId}`);
  
  // Combine all events and check for duplicates
  const allEvents = [...liveSSE.events, ...replaySSE.events];
  const allEventIds = new Set(allEvents.map(e => e.id));
  
  console.log(`\n5. Duplicate Analysis:`);
  console.log(`   Total events received: ${allEvents.length}`);
  console.log(`   Unique event IDs: ${allEventIds.size}`);
  console.log(`   Duplicates: ${allEvents.length - allEventIds.size}`);
  
  // Check for duplicates
  const hasDuplicates = allEvents.length !== allEventIds.size;
  console.log(`✅ No duplicates: ${!hasDuplicates}`);
  
  // Check event ID format
  const validEventIds = allEvents.every(e => {
    const parts = e.id.split('.');
    return parts.length === 3 && parts[2].length === 10;
  });
  console.log(`✅ Event ID format valid: ${validEventIds}`);
  
  // Check replay window limits
  const replayWithinLimit = liveSSE.totalCount <= 100;
  console.log(`✅ Replay within limit (≤100): ${replayWithinLimit} (${liveSSE.totalCount})`);
  
  // Validate event IDs are monotonic
  const eventSeqs = allEvents
    .map(e => {
      const parts = e.id.split('.');
      return parts.length === 3 ? parseInt(parts[2], 10) : 0;
    })
    .filter(seq => seq > 0);
  
  const isMonotonic = eventSeqs.every((seq, i) => i === 0 || seq > eventSeqs[i - 1]);
  console.log(`✅ Event IDs monotonic: ${isMonotonic}`);
  
  // Final validation
  const success = !hasDuplicates && isMonotonic && validEventIds && replayWithinLimit;
  
  console.log('\n📊 Test Results:');
  console.log(`   No duplicates: ${!hasDuplicates ? '✅' : '❌'}`);
  console.log(`   Monotonic IDs: ${isMonotonic ? '✅' : '❌'}`);
  console.log(`   Valid format: ${validEventIds ? '✅' : '❌'}`);
  console.log(`   Replay limit: ${replayWithinLimit ? '✅' : '❌'}`);
  console.log(`   Overall: ${success ? '✅ PASS' : '❌ FAIL'}`);
  
  return success;
}

// Run the test
runSSEDedupingTest().then(success => {
  console.log(`\n🎯 SSE De-duping Test ${success ? 'PASSED' : 'FAILED'}`);
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Test failed with error:', error);
  process.exit(1);
});
