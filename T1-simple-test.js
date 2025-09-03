const http = require('http');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const WORKSPACE_ID = 'test-workspace-' + Date.now();

// Test state
let testResults = {
    t0: null,
    t1: null,
    runIds: [],
    runStatuses: [],
    metrics: {}
};

// Utility functions
function makeRequest(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-Workspace-ID': WORKSPACE_ID
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const jsonData = data ? JSON.parse(data) : null;
                    resolve({ status: res.statusCode, data: jsonData });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
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

function getMetrics() {
    return makeRequest('/metrics');
}

function snapshotMetrics(label) {
    return getMetrics().then(result => {
        console.log(`\n=== ${label} Metrics Snapshot ===`);
        console.log(`Status: ${result.status}`);
        if (result.status === 200) {
            const metrics = result.data;
            const counters = {};
            metrics.split('\n').forEach(line => {
                if (line.includes('sentinel_') && line.includes(' ')) {
                    const [metric, value] = line.split(' ');
                    counters[metric] = parseInt(value);
                }
            });
            console.log('Key counters:', counters);
            testResults[label] = { timestamp: new Date().toISOString(), counters };
        }
        return result;
    });
}

function startRun(agentSlug) {
    return makeRequest(`/api/agents/${agentSlug}/run`, 'POST', {
        workspace_id: WORKSPACE_ID,
        input: { message: 'Hello, this is a test run' }
    });
}

function getRunStatus(runId) {
    return makeRequest(`/api/runs/${runId}`);
}

// Test 1: Sanity & Baseline
async function testSanityBaseline() {
    console.log('\n=== 1. SANITY & BASELINE ===');
    
    // Check health and ready endpoints
    const health = await makeRequest('/health');
    const ready = await makeRequest('/ready');
    
    console.log(`Health: ${health.status}`);
    console.log(`Ready: ${ready.status}`);
    
    if (health.status !== 200 || ready.status !== 200) {
        throw new Error('Health or ready endpoint failed');
    }
    
    // Snapshot baseline metrics
    await snapshotMetrics('t0');
    
    console.log('✅ Sanity & Baseline: PASS');
}

// Test 2: Agents & Runs (core happy path)
async function testAgentsRuns() {
    console.log('\n=== 2. AGENTS & RUNS (CORE HAPPY PATH) ===');
    
    // Get existing demo agents
    const agentsResponse = await makeRequest('/api/agents');
    console.log(`Found ${agentsResponse.data.length} demo agents`);
    
    if (agentsResponse.data.length < 2) {
        throw new Error('Need at least 2 demo agents for testing');
    }
    
    const agentA = agentsResponse.data[0]; // Demo Enricher
    const agentB = agentsResponse.data[1]; // Demo Scraper
    
    console.log(`Using Agent A: ${agentA.name} (${agentA.slug})`);
    console.log(`Using Agent B: ${agentB.name} (${agentB.slug})`);
    
    const runIds = [];
    const startTimes = [];
    
    // Start 5 runs for Agent A
    console.log('\nStarting Agent A runs...');
    for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        const run = await startRun(agentA.slug);
        console.log(`Agent A Run ${i + 1}: ${run.data.run_id}`);
        runIds.push(run.data.run_id);
        startTimes.push(startTime);
    }
    
    // Start 5 runs for Agent B
    console.log('\nStarting Agent B runs...');
    for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        const run = await startRun(agentB.slug);
        console.log(`Agent B Run ${i + 1}: ${run.data.run_id}`);
        runIds.push(run.data.run_id);
        startTimes.push(startTime);
    }
    
    // Wait for all runs to complete and verify
    console.log('\nWaiting for runs to complete...');
    for (let i = 0; i < runIds.length; i++) {
        let attempts = 0;
        let runStatus = null;
        
        while (attempts < 30) { // Max 30 seconds per run
            runStatus = await getRunStatus(runIds[i]);
            if (['complete', 'failed', 'stopped'].includes(runStatus.data.status)) {
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
        }
        
        console.log(`Run ${runIds[i]}: ${runStatus.data.status}`);
        
        // Store run status for analysis
        testResults.runStatuses.push({
            runId: runIds[i],
            status: runStatus.data.status,
            duration: Date.now() - startTimes[i],
            hasSpans: runStatus.data.spans && runStatus.data.spans.length > 0,
            hasVerdict: !!runStatus.data.verdict,
            hasShieldDecision: !!runStatus.data.shield_decision,
            hasGuardEvents: runStatus.data.guard_events && runStatus.data.guard_events.length > 0
        });
        
        // Verify run has required components
        if (!runStatus.data.spans || runStatus.data.spans.length === 0) {
            console.log(`⚠️  Run ${runIds[i]} missing spans`);
        }
        if (!runStatus.data.verdict) {
            console.log(`⚠️  Run ${runIds[i]} missing verdict`);
        }
        if (!runStatus.data.shield_decision) {
            console.log(`⚠️  Run ${runIds[i]} missing shield decision`);
        }
        
        // Check for guard events
        const guardEvents = runStatus.data.guard_events || [];
        if (guardEvents.length === 0) {
            console.log(`⚠️  Run ${runIds[i]} missing guard events`);
        }
        
        // Calculate timing
        const endTime = Date.now();
        const duration = endTime - startTimes[i];
        console.log(`Run ${runIds[i]} duration: ${duration}ms`);
    }
    
    testResults.runIds = runIds;
    await snapshotMetrics('t1');
    
    // Analyze results
    const completedRuns = testResults.runStatuses.filter(r => r.status === 'complete');
    const runsWithSpans = testResults.runStatuses.filter(r => r.hasSpans);
    const runsWithVerdict = testResults.runStatuses.filter(r => r.hasVerdict);
    const runsWithShield = testResults.runStatuses.filter(r => r.hasShieldDecision);
    const runsWithGuardEvents = testResults.runStatuses.filter(r => r.hasGuardEvents);
    
    console.log('\n=== RUN ANALYSIS ===');
    console.log(`Total runs: ${testResults.runStatuses.length}`);
    console.log(`Completed runs: ${completedRuns.length}`);
    console.log(`Runs with spans: ${runsWithSpans.length}`);
    console.log(`Runs with verdict: ${runsWithVerdict.length}`);
    console.log(`Runs with shield decision: ${runsWithShield.length}`);
    console.log(`Runs with guard events: ${runsWithGuardEvents.length}`);
    
    if (completedRuns.length >= 8) { // At least 80% success rate
        console.log('✅ Agents & Runs: PASS');
    } else {
        throw new Error(`Only ${completedRuns.length}/${testResults.runStatuses.length} runs completed successfully`);
    }
}

// Main test execution
async function runT1SimpleTest() {
    console.log('🚀 Starting T1 Simple Functionality Test');
    console.log(`Workspace ID: ${WORKSPACE_ID}`);
    console.log('⚠️  Note: Using simple gateway - focused on core functionality');
    
    try {
        await testSanityBaseline();
        await testAgentsRuns();
        
        console.log('\n🎉 T1 SIMPLE TEST COMPLETE - CORE FUNCTIONALITY VERIFIED');
        
        // Generate summary report
        console.log('\n=== T1 SIMPLE TEST SUMMARY ===');
        console.log('Status: PASS');
        console.log(`Total runs executed: ${testResults.runIds.length}`);
        console.log(`Completed runs: ${testResults.runStatuses.filter(r => r.status === 'complete').length}`);
        console.log(`Average run duration: ${Math.round(testResults.runStatuses.reduce((sum, r) => sum + r.duration, 0) / testResults.runStatuses.length)}ms`);
        
        // Save detailed results
        const fs = require('fs');
        fs.writeFileSync('T1-simple-test-results.json', JSON.stringify(testResults, null, 2));
        console.log('\nDetailed results saved to: T1-simple-test-results.json');
        
    } catch (error) {
        console.error('\n❌ T1 SIMPLE TEST FAILED');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        // Save failure results
        const fs = require('fs');
        testResults.error = error.message;
        testResults.stack = error.stack;
        fs.writeFileSync('T1-simple-test-failure.json', JSON.stringify(testResults, null, 2));
        
        process.exit(1);
    }
}

// Run the test
runT1SimpleTest();
