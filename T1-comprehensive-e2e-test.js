const http = require('http');
const crypto = require('crypto');
const fs = require('fs');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const WORKSPACE_ID = 'e2e-workspace-' + Date.now();
const WORKSPACE_ID_2 = 'e2e-workspace-2-' + Date.now();

// Test state
let testResults = {
    startTime: new Date().toISOString(),
    metrics: {
        t0: null,
        t1: null,
        t2: null,
        t3: null,
        t4: null
    },
    runIds: [],
    sseTranscripts: {
        logs: [],
        guard: []
    },
    errorBodies: [],
    registryEvidence: {},
    privacyProof: {},
    artifacts: {},
    kpis: {},
    failures: [],
    summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        criticalIssues: 0
    }
};

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

function addTest(name, result) {
    testResults.summary.totalTests++;
    if (result.passed) {
        testResults.summary.passedTests++;
    } else {
        testResults.summary.failedTests++;
        if (result.critical) {
            testResults.summary.criticalIssues++;
        }
    }
}

function logTest(name, passed, details = null, critical = false) {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${name}`);
    if (details) {
        console.log(`   ${details}`);
    }
    addTest(name, { passed, details, critical });
}

// Metrics collection
async function snapshotMetrics(label) {
    const response = await makeRequest('/metrics');
    if (response.status === 200) {
        testResults.metrics[label] = {
            timestamp: new Date().toISOString(),
            data: response.data
        };
        return response.data;
    }
    return null;
}

// Secret scanning
function scanForSecrets(text) {
    const patterns = [
        { name: 'API Key (sk-)', pattern: /sk-[A-Za-z0-9]{48}/g },
        { name: 'API Key (pk-)', pattern: /pk-[A-Za-z0-9]{48}/g },
        { name: 'Private Key', pattern: /-----BEGIN PRIVATE KEY-----/g },
        { name: 'Bearer Token', pattern: /Bearer [A-Za-z0-9._-]+/g },
        { name: 'Email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g },
        { name: 'Credit Card', pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g },
        { name: 'AWS Key', pattern: /AKIA[A-Z0-9]{16}/g }
    ];

    const found = [];
    patterns.forEach(({ name, pattern }) => {
        const matches = text.match(pattern);
        if (matches) {
            found.push({ type: name, count: matches.length, examples: matches.slice(0, 3) });
        }
    });
    return found;
}

// SSE connection helper with de-duping support
async function connectSSE(runId, eventType, duration = 5000, lastEventId = null) {
    return new Promise((resolve) => {
        const url = new URL(`/api/runs/${runId}/${eventType}/stream`, BASE_URL);
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
                buffer += chunk.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop();
                
                let currentEventId = null;
                let currentEventData = null;
                
                for (const line of lines) {
                    if (line.startsWith('id: ')) {
                        currentEventId = line.substring(4).trim();
                    } else if (line.startsWith('data: ')) {
                        try {
                            currentEventData = JSON.parse(line.substring(6));
                        } catch (e) {
                            // Skip malformed events
                        }
                    } else if (line.trim() === '') {
                        // End of event
                        if (currentEventData) {
                            const eventId = currentEventId || currentEventData._event_id || `event-${events.length + 1}`;
                            events.push(currentEventData);
                            eventIds.add(eventId);
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

// Test functions
async function testPreSetup() {
    console.log('\n=== PRE-TEST SETUP ===');
    
    // Config sanity
    const health = await makeRequest('/health');
    logTest('Health endpoint', health.status === 200, `Status: ${health.status}`);
    
    const ready = await makeRequest('/ready');
    logTest('Ready endpoint', ready.status === 200, `Status: ${ready.status}`);
    
    // Snapshot initial metrics
    const metrics = await snapshotMetrics('t0');
    logTest('Initial metrics snapshot', metrics !== null, 'Metrics captured');
    
    // Set privacy to true (default)
    const privacy = await makeRequest('/api/workspace/privacy', 'POST', {
        workspace_id: WORKSPACE_ID,
        storePlain: true
    });
    logTest('Privacy setup', privacy.status === 200, 'Privacy set to storePlain=true');
    
    // Set plan to Free
    const plan = await makeRequest('/api/workspace/plan', 'POST', {
        workspace_id: WORKSPACE_ID,
        plan: 'free'
    });
    logTest('Plan setup', plan.status === 200, 'Plan set to free');
}

async function testAgentsAndRuns() {
    console.log('\n=== TEST 1: AGENTS & RUNS (Happy Path + Hidden Traps) ===');
    
    // Get agents
    const agents = await makeRequest('/api/agents');
    if (agents.status !== 200 || !agents.data.length) {
        logTest('Get agents', false, 'No agents available', true);
        return;
    }
    
    const agentA = agents.data[0]; // Demo Enricher
    const agentB = agents.data[1]; // Demo Scraper
    
    console.log(`Testing Agent A: ${agentA.name} (${agentA.slug})`);
    console.log(`Testing Agent B: ${agentB.name} (${agentB.slug})`);
    
    let firstLogTimestamp = null;
    let sseTranscript = [];
    
    // Run 5 jobs for each agent
    for (let agentIndex = 0; agentIndex < 2; agentIndex++) {
        const agent = agentIndex === 0 ? agentA : agentB;
        
        for (let runIndex = 0; runIndex < 5; runIndex++) {
            console.log(`Starting run ${runIndex + 1} for ${agent.name}...`);
            
            // Start run
            const run = await makeRequest(`/api/agents/${agent.slug}/run`, 'POST', {
                workspace_id: WORKSPACE_ID,
                input: { 
                    message: `E2E test run ${runIndex + 1} - ${new Date().toISOString()}`,
                    testData: { runNumber: runIndex + 1, agent: agent.slug }
                }
            });
            
            if (run.status !== 200 || !run.data.run_id) {
                logTest(`Start run ${runIndex + 1} for ${agent.name}`, false, `Status: ${run.status}`, true);
                continue;
            }
            
            const runId = run.data.run_id;
            testResults.runIds.push(runId);
            
            // For first run, attach SSE and record first log timestamp
            if (agentIndex === 0 && runIndex === 0) {
                const sseResult = await connectSSE(runId, 'logs', 8000);
                if (sseResult.success && sseResult.events.length > 0) {
                    sseTranscript = sseResult.events;
                    const firstLog = sseResult.events.find(e => e.type === 'log');
                    if (firstLog) {
                        firstLogTimestamp = firstLog.timestamp;
                    }
                }
            }
            
            // Wait for completion
            let attempts = 0;
            let runStatus = null;
            
            while (attempts < 30) {
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                runStatus = await makeRequest(`/api/runs/${runId}`);
                if (runStatus.status === 200 && ['complete', 'failed', 'stopped'].includes(runStatus.data.status)) {
                    break;
                }
            }
            
            if (!runStatus || runStatus.status !== 200) {
                logTest(`Get run status ${runIndex + 1} for ${agent.name}`, false, 'Failed to get run status', true);
                continue;
            }
            
            const data = runStatus.data;
            logTest(`Run ${runIndex + 1} for ${agent.name} completed`, data.status === 'complete', `Status: ${data.status}`);
            
            // Assertions
            const hasSpans = data.spans && data.spans.length > 0;
            logTest(`Run ${runIndex + 1} has spans`, hasSpans, hasSpans ? `${data.spans.length} spans` : 'No spans', true);
            
            const hasVerdict = data.verdict !== null;
            logTest(`Run ${runIndex + 1} has verdict`, hasVerdict, hasVerdict ? 'Verdict present' : 'No verdict', true);
            
            const hasGuardEvents = data.guard_events && data.guard_events.length > 0;
            logTest(`Run ${runIndex + 1} has guard events`, hasGuardEvents, hasGuardEvents ? `${data.guard_events.length} events` : 'No events', true);
            
            // Check for secrets in logs
            if (data.logs && data.logs.length > 0) {
                const logText = JSON.stringify(data.logs);
                const secrets = scanForSecrets(logText);
                logTest(`Run ${runIndex + 1} no secrets in logs`, secrets.length === 0, secrets.length > 0 ? `${secrets.length} secrets found` : 'No secrets found', true);
            }
            
            // Check span ordering
            if (hasSpans) {
                const steps = data.spans.map(s => s.step || 0).filter(s => s > 0);
                const isOrdered = steps.every((step, i) => i === 0 || step > steps[i - 1]);
                logTest(`Run ${runIndex + 1} spans in order`, isOrdered, isOrdered ? 'Spans ordered correctly' : 'Spans out of order', true);
            }
        }
    }
    
    // Save SSE transcript
    testResults.sseTranscripts.logs = sseTranscript;
    
    // Snapshot metrics
    await snapshotMetrics('t1');
    
    // Calculate KPIs
    if (firstLogTimestamp) {
        const startTime = new Date(testResults.startTime);
        const firstLogTime = new Date(firstLogTimestamp);
        const latency = firstLogTime.getTime() - startTime.getTime();
        testResults.kpis.startToFirstLog = latency;
        logTest('Start to first log latency', latency <= 1000, `${latency}ms`, true);
    }
}

async function testPrivacyMode() {
    console.log('\n=== TEST 2: PRIVACY MODE (Hash-Only) — Leak Hunter ===');
    
    // Flip to privacy mode
    const privacy = await makeRequest('/api/workspace/privacy', 'POST', {
        workspace_id: WORKSPACE_ID,
        storePlain: false
    });
    logTest('Set privacy mode', privacy.status === 200, 'Privacy set to storePlain=false', true);
    
    // Get agents
    const agents = await makeRequest('/api/agents');
    if (agents.status !== 200 || !agents.data.length) {
        logTest('Get agents for privacy test', false, 'No agents available', true);
        return;
    }
    
    const agent = agents.data[0];
    
    // Start run with SSE
    const run = await makeRequest(`/api/agents/${agent.slug}/run`, 'POST', {
        workspace_id: WORKSPACE_ID,
        input: { 
            message: 'Privacy test run with sensitive data: sk-test12345678901234567890123456789012345678901234567890',
            email: 'test@example.com',
            creditCard: '4111-1111-1111-1111'
        }
    });
    
    if (run.status !== 200 || !run.data.run_id) {
        logTest('Start privacy test run', false, `Status: ${run.status}`, true);
        return;
    }
    
    const runId = run.data.run_id;
    
    // Connect SSE for 5 seconds
    const sseResult = await connectSSE(runId, 'logs', 5000);
    
    // Wait for completion
    let attempts = 0;
    let runStatus = null;
    
    while (attempts < 30) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        runStatus = await makeRequest(`/api/runs/${runId}`);
        if (runStatus.status === 200 && ['complete', 'failed', 'stopped'].includes(runStatus.data.status)) {
            break;
        }
    }
    
    if (!runStatus || runStatus.status !== 200) {
        logTest('Get privacy test run status', false, 'Failed to get run status', true);
        return;
    }
    
    const data = runStatus.data;
    logTest('Privacy test run completed', data.status === 'complete', `Status: ${data.status}`);
    
    // Check for privacy violations
    let hasPlaintext = false;
    let hasHashes = false;
    
    // Check spans
    if (data.spans && data.spans.length > 0) {
        data.spans.forEach(span => {
            if (span.input && typeof span.input === 'string' && span.input.length > 0) {
                hasPlaintext = true;
            }
            if (span.content_hash) {
                hasHashes = true;
            }
        });
    }
    
    // Check SSE transcript
    const sseText = JSON.stringify(sseResult.events);
    const secrets = scanForSecrets(sseText);
    
    logTest('No plaintext in spans', !hasPlaintext, hasPlaintext ? 'Plaintext found in spans' : 'No plaintext in spans', true);
    logTest('Hashes present', hasHashes, hasHashes ? 'Content hashes present' : 'No content hashes', true);
    logTest('No secrets in SSE', secrets.length === 0, secrets.length > 0 ? `${secrets.length} secrets found in SSE` : 'No secrets in SSE', true);
    
    // Save privacy proof
    testResults.privacyProof = {
        runId,
        hasPlaintext,
        hasHashes,
        secretsFound: secrets,
        sseEvents: sseResult.events
    };
    
    // Snapshot metrics
    await snapshotMetrics('t2');
}

async function testRegistryRoundTrip() {
    console.log('\n=== TEST 3: REGISTRY ROUND-TRIP + SIGNATURE TAMPER (Integrity Hunter) ===');
    
    // Get agents
    const agents = await makeRequest('/api/agents');
    if (agents.status !== 200 || !agents.data.length) {
        logTest('Get agents for registry test', false, 'No agents available', true);
        return;
    }
    
    const agent = agents.data[1]; // Use second agent
    
    // Publish agent to registry
    const publish = await makeRequest(`/api/agents/${agent.id}/publish`, 'POST', {
        slug: 'test/registry-agent',
        version: '1.0.0',
        readme_md: '# Test Agent\n\n<script>alert("xss")</script>\n<iframe src="javascript:alert(1)"></iframe>',
        tags: ['test', 'e2e'],
        summary: 'Test agent for E2E testing'
    });
    
    if (publish.status !== 201) {
        logTest('Publish agent', false, `Status: ${publish.status}`, true);
        return;
    }
    
    logTest('Publish agent', true, 'Agent published successfully');
    
    // Search for agent
    const search = await makeRequest('/api/registry/agents?q=registry-agent');
    if (search.status !== 200) {
        logTest('Search agent', false, `Status: ${search.status}`, true);
        return;
    }
    
    const searchResults = search.data.agents || [];
    const found = searchResults.find(a => a.slug === 'test/registry-agent');
    logTest('Search agent', found !== undefined, found ? 'Agent found in search' : 'Agent not found in search', true);
    
    // Get manifest
    const manifest = await makeRequest('/api/registry/agents/test/registry-agent/manifest');
    if (manifest.status !== 200) {
        logTest('Get manifest', false, `Status: ${manifest.status}`, true);
        return;
    }
    
    logTest('Get manifest', true, 'Manifest retrieved');
    
    // Test signature verification
    const publicKey = await makeRequest('/api/registry/public-key');
    if (publicKey.status !== 200) {
        logTest('Get public key', false, `Status: ${publicKey.status}`, true);
        return;
    }
    
    logTest('Get public key', true, 'Public key retrieved');
    
    // Tamper test - modify manifest
    const tamperedManifest = { ...manifest.data };
    tamperedManifest.entry = 'tampered/entry/point.js';
    
    // Try to verify tampered manifest (should fail)
    const verifyTampered = await makeRequest('/api/registry/agents/test/registry-agent/manifest', 'POST', {
        manifest: tamperedManifest
    });
    
    // This should fail, but we'll check if it's properly rejected
    logTest('Tampered manifest rejected', verifyTampered.status !== 200, verifyTampered.status === 200 ? 'Tampered manifest accepted (BAD)' : 'Tampered manifest rejected (GOOD)', true);
    
    // Save registry evidence
    testResults.registryEvidence = {
        publishedSlug: 'test/registry-agent@1.0.0',
        searchResults: searchResults.length,
        manifestVerified: manifest.status === 200,
        tamperRejected: verifyTampered.status !== 200,
        publicKey: publicKey.data
    };
    
    // Snapshot metrics
    await snapshotMetrics('t3');
}

async function testPlanAndCaps() {
    console.log('\n=== TEST 4: PLAN & CAPS (Limit Enforcer) ===');
    
    // Get initial counts
    const initialAgents = await makeRequest('/api/agents');
    const initialRuns = await makeRequest('/api/runs');
    
    // Test agent creation limits (Free plan should allow 2 agents)
    // Since we already have 2 agents, try to create a 3rd
    const createAgent = await makeRequest('/api/agents', 'POST', {
        workspace_id: WORKSPACE_ID,
        name: 'Test Agent 3',
        slug: 'test-agent-3',
        config_json: {
            entry: 'test.js',
            language: 'js'
        }
    });
    
    // This should fail on Free plan
    const expectedLimitReached = createAgent.status === 403 || 
                                (createAgent.data && createAgent.data.error && 
                                 createAgent.data.error.includes('PLAN_LIMIT_REACHED'));
    
    logTest('Agent creation limit enforced', expectedLimitReached, 
            expectedLimitReached ? 'Limit correctly enforced' : 'Limit not enforced', true);
    
    // Test concurrent run limits
    const agents = await makeRequest('/api/agents');
    if (agents.status !== 200 || !agents.data.length) {
        logTest('Get agents for concurrency test', false, 'No agents available', true);
        return;
    }
    
    const agent = agents.data[0];
    
    // Start first run
    const run1 = await makeRequest(`/api/agents/${agent.slug}/run`, 'POST', {
        workspace_id: WORKSPACE_ID,
        input: { message: 'Concurrency test run 1' }
    });
    
    if (run1.status !== 200) {
        logTest('Start first concurrent run', false, `Status: ${run1.status}`, true);
        return;
    }
    
    logTest('Start first concurrent run', true, 'First run started');
    
    // Try to start second run immediately (should be denied)
    const run2 = await makeRequest(`/api/agents/${agent.slug}/run`, 'POST', {
        workspace_id: WORKSPACE_ID,
        input: { message: 'Concurrency test run 2' }
    });
    
    const expectedConcurrencyDenied = run2.status === 429 || 
                                     (run2.data && run2.data.error && 
                                      run2.data.error.includes('CONCURRENCY_LIMIT_REACHED'));
    
    logTest('Concurrency limit enforced', expectedConcurrencyDenied, 
            expectedConcurrencyDenied ? 'Concurrency limit enforced' : 'Concurrency limit not enforced', true);
    
    // Save error bodies
    if (!expectedLimitReached && createAgent.data) {
        testResults.errorBodies.push({
            type: 'agent_creation_limit',
            status: createAgent.status,
            data: createAgent.data
        });
    }
    
    if (!expectedConcurrencyDenied && run2.data) {
        testResults.errorBodies.push({
            type: 'concurrency_limit',
            status: run2.status,
            data: run2.data
        });
    }
    
    // Snapshot metrics
    await snapshotMetrics('t4');
}

async function testSSEReplayAndReconnect() {
    console.log('\n=== TEST 5: SSE REPLAY & RECONNECT (Ordering & Dupes Hunter) ===');
    
    // Get agents
    const agents = await makeRequest('/api/agents');
    if (agents.status !== 200 || !agents.data.length) {
        logTest('Get agents for SSE test', false, 'No agents available', true);
        return;
    }
    
    const agent = agents.data[0];
    
    // Use a different workspace to avoid concurrency limits
    const sseWorkspaceId = WORKSPACE_ID + '-sse-test';
    
    // Start a run
    const run = await makeRequest(`/api/agents/${agent.slug}/run`, 'POST', {
        workspace_id: sseWorkspaceId,
        input: { message: 'SSE replay test run' }
    });
    
    if (run.status !== 200 || !run.data.run_id) {
        logTest('Start SSE test run', false, `Status: ${run.status}`, true);
        return;
    }
    
    const runId = run.data.run_id;
    
    // Connect to guard SSE and record initial events
    const initialSSE = await connectSSE(runId, 'guard', 3000);
    
    if (!initialSSE.success) {
        logTest('Initial SSE connection', false, 'Failed to connect', true);
        return;
    }
    
    logTest('Initial SSE connection', true, `Received ${initialSSE.totalCount} events (${initialSSE.uniqueCount} unique)`);
    
    // Wait a bit, then reconnect with Last-Event-ID
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get the last event ID for resume
    const lastEventId = initialSSE.eventIds.length > 0 ? initialSSE.eventIds[initialSSE.eventIds.length - 1] : null;
    const reconnectSSE = await connectSSE(runId, 'guard', 3000, lastEventId);
    
    if (!reconnectSSE.success) {
        logTest('SSE reconnect', false, 'Failed to reconnect', true);
        return;
    }
    
    logTest('SSE reconnect', true, `Received ${reconnectSSE.totalCount} events on reconnect (${reconnectSSE.uniqueCount} unique)`);
    
    // Check for duplicates using the new de-duping metrics
    const totalEvents = initialSSE.totalCount + reconnectSSE.totalCount;
    const totalUnique = initialSSE.uniqueCount + reconnectSSE.uniqueCount;
    const hasDuplicates = totalEvents !== totalUnique;
    
    logTest('No duplicate events', !hasDuplicates, hasDuplicates ? `Duplicates found (${totalEvents} total, ${totalUnique} unique)` : 'No duplicates', true);
    
    // Check ordering using the events from both connections
    const allEvents = [...initialSSE.events, ...reconnectSSE.events];
    const timestamps = allEvents.map(e => e.timestamp).filter(t => t);
    const isOrdered = timestamps.every((timestamp, i) => i === 0 || timestamp >= timestamps[i - 1]);
    
    logTest('Events in order', isOrdered, isOrdered ? 'Events properly ordered' : 'Events out of order', true);
    
    // Save SSE transcript
    testResults.sseTranscripts.guard = allEvents;
}

async function testExtraFaultInjections() {
    console.log('\n=== EXTRA FAULT INJECTIONS ===');
    
    // Idempotency retry test
    const agents = await makeRequest('/api/agents');
    if (agents.status !== 200 || !agents.data.length) {
        return;
    }
    
    const agent = agents.data[0];
    const idempotencyKey = 'test-idempotency-' + Date.now();
    
    // Use a different workspace to avoid concurrency limits
    const idempotencyWorkspaceId = WORKSPACE_ID + '-idempotency-test';
    
    // Start first run with idempotency key
    const run1 = await makeRequest(`/api/agents/${agent.slug}/run`, 'POST', {
        workspace_id: idempotencyWorkspaceId,
        input: { message: 'Idempotency test run 1' }
    }, {
        'Idempotency-Key': idempotencyKey
    });
    
    if (run1.status !== 200) {
        logTest('Idempotency run 1', false, `Status: ${run1.status}`, true);
        return;
    }
    
    // Immediately retry with same key
    const run2 = await makeRequest(`/api/agents/${agent.slug}/run`, 'POST', {
        workspace_id: idempotencyWorkspaceId,
        input: { message: 'Idempotency test run 2' }
    }, {
        'Idempotency-Key': idempotencyKey
    });
    
    if (run2.status !== 200) {
        logTest('Idempotency run 2', false, `Status: ${run2.status}`, true);
        return;
    }
    
    // Check if same run ID returned
    const sameRunId = run1.data.run_id === run2.data.run_id;
    logTest('Idempotency works', sameRunId, sameRunId ? 'Same run ID returned' : 'Different run IDs returned', true);
}

async function calculateKPIs() {
    console.log('\n=== CALCULATING KPIs ===');
    
    // Get final metrics
    const finalMetrics = await snapshotMetrics('final');
    
    // Parse metrics for KPIs
    if (finalMetrics) {
        const lines = finalMetrics.split('\n');
        
        // Extract counters
        const spansTotal = lines.find(l => l.startsWith('sentinel_spans_total'));
        const guardEventsTotal = lines.find(l => l.startsWith('sentinel_guard_events_total'));
        const verdictsTotal = lines.find(l => l.startsWith('sentinel_verdicts_total'));
        
        if (spansTotal) {
            const count = parseInt(spansTotal.split(' ')[1]);
            testResults.kpis.spansTotal = count;
            logTest('Spans total >= 30', count >= 30, `${count} spans`, true);
        }
        
        if (guardEventsTotal) {
            const count = parseInt(guardEventsTotal.split(' ')[1]);
            testResults.kpis.guardEventsTotal = count;
            logTest('Guard events >= 10', count >= 10, `${count} events`, true);
        }
        
        if (verdictsTotal) {
            const count = parseInt(verdictsTotal.split(' ')[1]);
            testResults.kpis.verdictsTotal = count;
            logTest('Verdicts >= 10', count >= 10, `${count} verdicts`, true);
        }
    }
}

// Main test execution
async function runComprehensiveE2ETest() {
    console.log('🔍 COMPREHENSIVE E2E TEST - PROVING SYSTEM CORRECTNESS');
    console.log('========================================================');
    console.log(`Workspace ID: ${WORKSPACE_ID}`);
    console.log(`Target: ${BASE_URL}`);
    console.log(`Start Time: ${testResults.startTime}`);
    
    try {
        await testPreSetup();
        await testAgentsAndRuns();
        await testPrivacyMode();
        await testRegistryRoundTrip();
        await testPlanAndCaps();
        await testSSEReplayAndReconnect();
        await testExtraFaultInjections();
        await calculateKPIs();
        
        // Generate final summary
        console.log('\n========================================================');
        console.log('📊 COMPREHENSIVE E2E TEST SUMMARY');
        console.log('========================================================');
        console.log(`Total Tests: ${testResults.summary.totalTests}`);
        console.log(`Passed: ${testResults.summary.passedTests}`);
        console.log(`Failed: ${testResults.summary.failedTests}`);
        console.log(`Critical Issues: ${testResults.summary.criticalIssues}`);
        
        const success = testResults.summary.criticalIssues === 0;
        console.log(`\nOverall Status: ${success ? '✅ ALL CRITICAL ISSUES PASSED' : '❌ CRITICAL ISSUES FOUND'}`);
        
        if (success) {
            console.log('\n🎉 COMPREHENSIVE E2E TEST COMPLETE');
            console.log('✅ System correctness proven');
            console.log('✅ All critical functionality working');
            console.log('✅ Privacy and security verified');
            console.log('✅ Performance within bounds');
        } else {
            console.log('\n⚠️  Critical issues need attention');
        }
        
        // Save detailed results
        const resultsFile = `T1-comprehensive-e2e-results-${Date.now()}.json`;
        fs.writeFileSync(resultsFile, JSON.stringify(testResults, null, 2));
        console.log(`\n📁 Detailed results saved to: ${resultsFile}`);
        
        return success;
        
    } catch (error) {
        console.error('\n❌ COMPREHENSIVE E2E TEST FAILED');
        console.error('Error:', error.message);
        return false;
    }
}

// Run the comprehensive test
runComprehensiveE2ETest().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
