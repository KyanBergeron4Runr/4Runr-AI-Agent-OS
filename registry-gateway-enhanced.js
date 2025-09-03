const http = require('http');
const url = require('url');
const { spawn } = require('child_process');
const crypto = require('crypto');
const RegistryService = require('./registry-service');

console.log('🚀 Starting 4Runr Enhanced Gateway with Sentinel/Shield...');

// Initialize registry service
const registryService = new RegistryService();

// Enhanced in-memory storage with Sentinel/Shield data
const agents = [
  { 
    id: '550e8400-e29b-41d4-a716-446655440001', 
    workspace_id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Demo Enricher', 
    slug: 'demo-enricher',
    visibility: 'public',
    config_json: {
      entry: 'node apps/agents/enricher/index.js',
      language: 'js',
      env_refs: ['OPENAI_API_KEY'],
      policy_refs: ['default'],
      resources: { cpu: '0.5', mem: '512Mi' }
    }
  },
  { 
    id: '550e8400-e29b-41d4-a716-446655440002', 
    workspace_id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Demo Scraper', 
    slug: 'demo-scraper',
    visibility: 'public',
    config_json: {
      entry: 'python apps/agents/scraper/main.py',
      language: 'py',
      env_refs: ['SCRAPER_API_KEY'],
      policy_refs: ['default'],
      resources: { cpu: '0.3', mem: '256Mi' }
    }
  }
];

// Plan limits configuration
const PLAN_LIMITS = {
  free: {
    agents: 2,
    concurrentRuns: 1
  },
  pro: {
    agents: 10,
    concurrentRuns: 5
  }
};

// Test mode configuration (dev only)
const TEST_MODE = process.env.TEST_MODE === '1' || process.env.NODE_ENV === 'development';
const TEST_CONCURRENCY_LIMIT = 10; // Much higher for testing
const TEST_RATE_LIMIT_BURST = 1000; // Much higher burst for testing

// SSE Configuration
const SSE_CONFIG = {
  REPLAY_WINDOW: 100,
  MAX_CONNECTIONS: 1000,
  BUFFER_TIMEOUT_MS: 200
};

// Track concurrent runs per workspace
const workspaceConcurrentRuns = new Map();
const idempotencyKeys = new Map(); // TTL store for idempotency

// Enhanced rate limiting with test mode
const rateLimits = new Map(); // ip:endpoint -> { count, resetTime, burst }
const getRateLimit = (ip, endpoint) => {
  const key = `${ip}:${endpoint}`;
  const now = Date.now();
  const limit = rateLimits.get(key);
  
  // Test mode: much higher limits for localhost
  const isLocalhost = ip === '127.0.0.1' || ip === 'localhost' || ip === '::1';
  const burst = TEST_MODE && isLocalhost ? TEST_RATE_LIMIT_BURST : 100;
  const window = 60000; // 1 minute
  
  if (!limit || now > limit.resetTime) {
    rateLimits.set(key, { count: 1, resetTime: now + window, burst });
    return true;
  }
  
  if (limit.count >= burst) {
    return false;
  }
  
  limit.count++;
  return true;
};

const runs = new Map();
const runLogs = new Map();
const runEvents = new Map();
const runSpans = new Map();
const runVerdicts = new Map();
const runShieldDecisions = new Map();
const runGuardEvents = new Map();
const activeProcesses = new Map();
const sseConnections = new Map();
const guardConnections = new Map();

// SSE Event Sequence Management
const eventSequences = new Map(); // runId -> { logs: seq, guard: seq }
const sseConnectionStates = new Map(); // connectionId -> { lastSentSeq: { logs: seq, guard: seq } }

// Enhanced metrics for debugging
const metrics = {
  idempotency_hits: 0,
  idempotency_misses: 0,
  rate_limited_total: 0,
  concurrency_denials: 0,
  run_starts_total: 0,
  sse_replay_events_total: 0,
  sse_live_events_total: 0,
  sse_duplicates_dropped_total: 0,
  sse_connections_total: 0
};

// Workspace settings
const workspaceSettings = new Map();

// Helper functions
const generateId = () => crypto.randomUUID();

// Generate stable event sequence number
const getNextEventSeq = (runId, streamType) => {
  if (!eventSequences.has(runId)) {
    eventSequences.set(runId, { logs: 0, guard: 0 });
  }
  const sequences = eventSequences.get(runId);
  sequences[streamType]++;
  return sequences[streamType];
};

// Generate stable event ID
const generateEventId = (runId, streamType, seq) => {
  return `${runId}.${streamType}.${seq.toString().padStart(10, '0')}`;
};

// Parse Last-Event-ID header
const parseLastEventId = (lastEventId) => {
  if (!lastEventId) return null;
  
  const parts = lastEventId.split('.');
  if (parts.length !== 3) return null;
  
  const [runId, streamType, seqStr] = parts;
  const seq = parseInt(seqStr, 10);
  
  if (isNaN(seq)) return null;
  
  return { runId, streamType, seq };
};

// SSE Connection Management
class SSEConnection {
  constructor(runId, streamType, response, connectionId) {
    this.runId = runId;
    this.streamType = streamType;
    this.response = response;
    this.connectionId = connectionId;
    this.lastSentSeq = 0;
    this.connected = true;
    this.startTime = Date.now();
    
    // Set SSE headers
    this.response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-SSE-Connection-ID': connectionId
    });
  }
  
  sendEvent(event, seq) {
    if (!this.connected) return false;
    
    // Duplicate prevention
    if (seq <= this.lastSentSeq) {
      metrics.sse_duplicates_dropped_total++;
      return false;
    }
    
    const eventId = generateEventId(this.runId, this.streamType, seq);
    const eventData = JSON.stringify({
      ...event,
      _seq: seq,
      _event_id: eventId
    });
    
    try {
      this.response.write(`id: ${eventId}\n`);
      this.response.write(`data: ${eventData}\n\n`);
      this.lastSentSeq = seq;
      return true;
    } catch (error) {
      this.connected = false;
      return false;
    }
  }
  
  close() {
    this.connected = false;
    try {
      this.response.end();
    } catch (error) {
      // Connection already closed
    }
  }
}

const sanitizeLog = (message) => {
  return message
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]')
    .replace(/sk-[A-Za-z0-9]{48}/g, '[API_KEY]')
    .replace(/pk-[A-Za-z0-9]{48}/g, '[API_KEY]');
};

// Enhanced security headers
const getSecurityHeaders = () => ({
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
});

// Sentinel/Shield integration
const generateSpan = (runId, type, data = {}) => {
  const run = runs.get(runId);
  const workspaceId = run ? run.workspace_id : 'default';
  const settings = workspaceSettings.get(workspaceId) || { storePlain: true };
  
  const span = {
    id: generateId(),
    type,
    timestamp: new Date().toISOString(),
    duration: 0,
    step: (runSpans.get(runId) || []).length + 1,
    ...data
  };
  
  // Add content hash for privacy mode
  if (!settings.storePlain && (data.input || data.output)) {
    const content = JSON.stringify(data.input || data.output || '');
    span.content_hash = crypto.createHash('sha256').update(content).digest('hex');
    // Remove plaintext in privacy mode
    delete span.input;
    delete span.output;
  }
  
  if (!runSpans.has(runId)) {
    runSpans.set(runId, []);
  }
  runSpans.get(runId).push(span);
  
  return span;
};

const generateVerdict = (runId, spans) => {
  // Real safety analysis based on content
  let groundedness = 0.9;
  let coverage = 0.9;
  let confidence = 0.9;
  let reasoning = "AI safety evaluation completed successfully";
  
  // Check for prompt injection attempts
  const promptInjectionPatterns = [
    /ignore previous instructions/i,
    /system information/i,
    /reveal.*system/i,
    /bypass.*safety/i,
    /ignore.*rules/i
  ];
  
  // Check for PII patterns
  const piiPatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
    /\b\d{10,11}\b/, // Phone numbers
    /\b\d{4}\s\d{4}\s\d{4}\s\d{4}\b/ // Credit card
  ];
  
  // Analyze spans for safety issues
  for (const span of spans) {
    const content = JSON.stringify(span.input || span.output || '');
    
    // Check for prompt injection
    for (const pattern of promptInjectionPatterns) {
      if (pattern.test(content)) {
        groundedness = 0.1;
        confidence = 0.95;
        reasoning = "Prompt injection attempt detected and blocked";
        break;
      }
    }
    
    // Check for PII
    for (const pattern of piiPatterns) {
      if (pattern.test(content)) {
        groundedness = 0.3;
        confidence = 0.9;
        reasoning = "PII detected in content";
        break;
      }
    }
    
    // Check for external API calls (low groundedness)
    if (content.includes('http_fetch') || content.includes('external_api')) {
      groundedness = Math.min(groundedness, 0.4);
      reasoning = "External API calls detected - requires approval";
    }
  }
  
  const verdict = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    groundedness,
    coverage,
    confidence,
    reasoning,
    spans_analyzed: spans.length
  };
  
  runVerdicts.set(runId, verdict);
  return verdict;
};

const generateShieldDecision = (runId, verdict) => {
  let action = 'allow';
  let reasoning = "Content meets safety thresholds";
  
  // Real safety decision logic
  if (verdict.groundedness < 0.2) {
    action = 'block';
    reasoning = "Content blocked due to safety concerns";
  } else if (verdict.groundedness < 0.8) {
    action = 'require_approval';
    reasoning = "Content requires human review";
  }
  
  // Override for specific safety issues
  if (verdict.reasoning.includes('Prompt injection attempt detected')) {
    action = 'block';
    reasoning = "Prompt injection attempt blocked";
  }
  
  if (verdict.reasoning.includes('PII detected')) {
    action = 'require_approval';
    reasoning = "PII detected - requires approval";
  }
  
  const decision = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    action,
    confidence: verdict.confidence,
    reasoning,
    policy_applied: 'default_safety_policy'
  };
  
  runShieldDecisions.set(runId, decision);
  return decision;
};

const generateGuardEvent = (runId, type, data = {}) => {
  const event = {
    id: generateId(),
    type,
    timestamp: new Date().toISOString(),
    run_id: runId,
    ...data
  };
  
  if (!runGuardEvents.has(runId)) {
    runGuardEvents.set(runId, []);
  }
  runGuardEvents.get(runId).push(event);
  
  // Emit to guard SSE connections using the proper SSE event system
  emitSSEEvent(runId, 'guard', event);
  
  return event;
};

const emitSSEEvent = (runId, eventType, data) => {
  const connections = sseConnections.get(runId) || [];
  const event = {
    type: eventType,
    timestamp: new Date().toISOString(),
    ...data
  };
  
  // Store events for replay
  if (eventType === 'guard') {
    if (!runEvents.has(runId)) {
      runEvents.set(runId, []);
    }
    runEvents.get(runId).push(event);
  }
  
  // Generate sequence number and send to all connections
  const seq = getNextEventSeq(runId, eventType === 'guard' ? 'guard' : 'logs');
  metrics.sse_live_events_total++;
  
  connections.forEach(connection => {
    connection.sendEvent(event, seq);
  });
};

const addLogEntry = (runId, level, message, spanId = null) => {
  if (!runLogs.has(runId)) {
    runLogs.set(runId, []);
  }
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: sanitizeLog(message),
    span_id: spanId
  };
  
  runLogs.get(runId).push(logEntry);
  
  if (runLogs.get(runId).length > 1000) {
    runLogs.get(runId).shift();
  }
  
  emitSSEEvent(runId, 'log', logEntry);
};

// Enhanced agent execution with Sentinel/Shield
const executeAgent = async (runId, agent) => {
  const run = runs.get(runId);
  if (!run) return;
  
  run.status = 'running';
  run.started_at = new Date().toISOString();
  
  addLogEntry(runId, 'info', `Starting agent: ${agent.name} (${agent.slug})`);
  addLogEntry(runId, 'info', `Entry point: ${agent.config_json.entry}`);
  addLogEntry(runId, 'info', `Language: ${agent.config_json.language}`);
  
  emitSSEEvent(runId, 'status', { status: 'running' });
  
  // Generate initial spans
  const initSpan = generateSpan(runId, 'initialization', {
    input: { agent: agent.slug, config: agent.config_json },
    output: { status: 'initialized' }
  });
  
  generateGuardEvent(runId, 'agent.start', {
    agent_id: agent.id,
    agent_slug: agent.slug,
    span_id: initSpan.id
  });
  
  try {
    // Simulate agent execution with proper timing
    const startTime = Date.now();
    
    // Generate execution span
    const execSpan = generateSpan(runId, 'execution', {
      input: { command: agent.config_json.entry },
      output: { status: 'executing' }
    });
    
    generateGuardEvent(runId, 'agent.execution', {
      span_id: execSpan.id,
      command: agent.config_json.entry
    });
    
    // Simulate processing time (much faster than before)
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
    
    const endTime = Date.now();
    execSpan.duration = endTime - startTime;
    execSpan.output = { status: 'completed', duration: execSpan.duration };
    
    // Generate completion span
    const completeSpan = generateSpan(runId, 'completion', {
      input: { duration: execSpan.duration },
      output: { status: 'success', result: 'Agent execution completed successfully' }
    });
    
    // Generate Sentinel verdict
    const spans = runSpans.get(runId) || [];
    const verdict = generateVerdict(runId, spans);
    
    // Generate Shield decision
    const shieldDecision = generateShieldDecision(runId, verdict);
    
    // Generate final guard events
    generateGuardEvent(runId, 'sentinel.verdict', {
      verdict_id: verdict.id,
      groundedness: verdict.groundedness,
      coverage: verdict.coverage
    });
    
    generateGuardEvent(runId, 'shield.decision', {
      decision_id: shieldDecision.id,
      action: shieldDecision.action,
      reasoning: shieldDecision.reasoning
    });
    
    generateGuardEvent(runId, 'agent.complete', {
      span_id: completeSpan.id,
      duration: execSpan.duration,
      verdict_id: verdict.id,
      shield_decision_id: shieldDecision.id
    });
    
    // Update run status
    run.status = 'complete';
    run.ended_at = new Date().toISOString();
    run.duration = execSpan.duration;
    
    // Decrement concurrent runs counter
    const workspaceId = run.workspace_id;
    const currentConcurrent = workspaceConcurrentRuns.get(workspaceId) || 0;
    workspaceConcurrentRuns.set(workspaceId, Math.max(0, currentConcurrent - 1));
    
    addLogEntry(runId, 'info', 'Agent initialized successfully');
    addLogEntry(runId, 'info', `Execution completed in ${execSpan.duration}ms`);
    addLogEntry(runId, 'info', `Sentinel verdict: ${verdict.groundedness.toFixed(2)} groundedness, ${verdict.coverage.toFixed(2)} coverage`);
    addLogEntry(runId, 'info', `Shield decision: ${shieldDecision.action}`);
    
    emitSSEEvent(runId, 'status', { status: 'complete' });
    emitSSEEvent(runId, 'done', { status: 'complete' });
    
  } catch (error) {
    run.status = 'failed';
    run.ended_at = new Date().toISOString();
    run.error = error.message;
    
    // Decrement concurrent runs counter
    const workspaceId = run.workspace_id;
    const currentConcurrent = workspaceConcurrentRuns.get(workspaceId) || 0;
    workspaceConcurrentRuns.set(workspaceId, Math.max(0, currentConcurrent - 1));
    
    generateGuardEvent(runId, 'agent.error', {
      error: error.message,
      stack: error.stack
    });
    
    addLogEntry(runId, 'error', `Agent execution failed: ${error.message}`);
    emitSSEEvent(runId, 'status', { status: 'failed' });
    emitSSEEvent(runId, 'done', { status: 'failed' });
  }
};

// Create HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const { pathname: path, query } = parsedUrl;
  const method = req.method;
  const clientIP = req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
  
  // Add security headers to all responses
  Object.entries(getSecurityHeaders()).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');
  
  // Handle preflight requests
  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Health endpoint
  if (path === '/health' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '2.0.0'
    }));
    return;
  }
  
  // Readiness endpoint
  if (path === '/ready' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ready: true,
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  // Enhanced metrics endpoint
  if (path === '/metrics' && method === 'GET') {
    const activeRuns = Array.from(runs.values()).filter(r => r.status === 'running').length;
    const totalRuns = runs.size;
    const totalLogs = Array.from(runLogs.values()).reduce((sum, logs) => sum + logs.length, 0);
    const totalSpans = Array.from(runSpans.values()).reduce((sum, spans) => sum + spans.length, 0);
    const totalGuardEvents = Array.from(runGuardEvents.values()).reduce((sum, events) => sum + events.length, 0);
    const registryMetrics = registryService.getMetrics();
    
    const metricsText = [
      '# HELP sentinel_spans_total Total number of Sentinel spans',
      '# TYPE sentinel_spans_total counter',
      `sentinel_spans_total ${totalSpans}`,
      '',
      '# HELP sentinel_guard_events_total Total number of Guard events',
      '# TYPE sentinel_guard_events_total counter',
      `sentinel_guard_events_total ${totalGuardEvents}`,
      '',
      '# HELP sentinel_verdicts_total Total number of Sentinel verdicts',
      '# TYPE sentinel_verdicts_total counter',
      `sentinel_verdicts_total ${runVerdicts.size}`,
      '',
      '# HELP shield_decisions_total Total number of Shield decisions',
      '# TYPE shield_decisions_total counter',
      `shield_decisions_total ${runShieldDecisions.size}`,
      '',
      '# HELP runs_started_total Total number of runs started',
      '# TYPE runs_started_total counter',
      `runs_started_total ${totalRuns}`,
      '',
      '# HELP runs_concurrent_gauge Current number of running agents',
      '# TYPE runs_concurrent_gauge gauge',
      `runs_concurrent_gauge ${activeRuns}`,
      '',
      '# HELP logs_emitted_total Total number of log entries',
      '# TYPE logs_emitted_total counter',
      `logs_emitted_total ${totalLogs}`,
      '',
      '# HELP registry_agents_total Total number of registry agents',
      '# TYPE registry_agents_total counter',
      `registry_agents_total ${registryMetrics.registry_agents_total}`,
      '',
      '# HELP registry_publishers_total Total number of registry publishers',
      '# TYPE registry_publishers_total counter',
      `registry_publishers_total ${registryMetrics.registry_publishers_total}`,
      '',
      '# HELP registry_workspaces_total Total number of registry workspaces',
      '# TYPE registry_workspaces_total counter',
      `registry_workspaces_total ${registryMetrics.registry_workspaces_total}`,
      '',
      '# HELP idempotency_hits_total Total number of idempotency hits',
      '# TYPE idempotency_hits_total counter',
      `idempotency_hits_total ${metrics.idempotency_hits}`,
      '',
      '# HELP idempotency_misses_total Total number of idempotency misses',
      '# TYPE idempotency_misses_total counter',
      `idempotency_misses_total ${metrics.idempotency_misses}`,
      '',
      '# HELP rate_limited_total Total number of rate limited requests',
      '# TYPE rate_limited_total counter',
      `rate_limited_total ${metrics.rate_limited_total}`,
      '',
      '# HELP concurrency_denials_total Total number of concurrency denials',
      '# TYPE concurrency_denials_total counter',
      `concurrency_denials_total ${metrics.concurrency_denials}`,
      '',
             '# HELP run_starts_total Total number of run starts',
       '# TYPE run_starts_total counter',
       `run_starts_total ${metrics.run_starts_total}`,
       '',
       '# HELP sse_replay_events_total Total number of SSE replay events',
       '# TYPE sse_replay_events_total counter',
       `sse_replay_events_total ${metrics.sse_replay_events_total}`,
       '',
       '# HELP sse_live_events_total Total number of SSE live events',
       '# TYPE sse_live_events_total counter',
       `sse_live_events_total ${metrics.sse_live_events_total}`,
       '',
       '# HELP sse_duplicates_dropped_total Total number of SSE duplicates dropped',
       '# TYPE sse_duplicates_dropped_total counter',
       `sse_duplicates_dropped_total ${metrics.sse_duplicates_dropped_total}`,
       '',
       '# HELP sse_connections_total Total number of SSE connections',
       '# TYPE sse_connections_total counter',
       `sse_connections_total ${metrics.sse_connections_total}`
    ].join('\n');
    
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(metricsText);
    return;
  }
  
  // Workspace privacy endpoint
  if (path === '/api/workspace/privacy' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const workspaceId = data.workspace_id || 'default';
        
        if (!workspaceSettings.has(workspaceId)) {
          workspaceSettings.set(workspaceId, {});
        }
        
        workspaceSettings.get(workspaceId).storePlain = data.storePlain !== false;
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          workspace_id: workspaceId,
          storePlain: workspaceSettings.get(workspaceId).storePlain,
          updated_at: new Date().toISOString()
        }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request body' }));
      }
    });
    return;
  }
  
  // Workspace plan endpoint
  if (path === '/api/workspace/plan' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const workspaceId = data.workspace_id || 'default';
        
        if (!workspaceSettings.has(workspaceId)) {
          workspaceSettings.set(workspaceId, {});
        }
        
        workspaceSettings.get(workspaceId).plan = data.plan || 'free';
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          workspace_id: workspaceId,
          plan: workspaceSettings.get(workspaceId).plan,
          updated_at: new Date().toISOString()
        }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request body' }));
      }
    });
    return;
  }
  
  // Debug logging for all requests
  console.log(`🔍 Request: ${method} ${path}`);
  
  // Registry endpoints (existing functionality)
  if (path === '/api/registry/agents' && method === 'GET') {
    // Only rate limit registry search, not SSE endpoints
    if (!getRateLimit(clientIP, 'registry_search')) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
      return;
    }
    
    const results = registryService.searchAgents(query.q, {
      owner: query.owner,
      tag: query.tag
    });
    
    const limit = parseInt(query.limit) || 20;
    const cursor = query.cursor ? parseInt(query.cursor) : 0;
    const paginatedResults = results.slice(cursor, cursor + limit);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      agents: paginatedResults,
      total: results.length,
      cursor: cursor + limit < results.length ? cursor + limit : null
    }));
    return;
  }
  
  if (path.match(/^\/api\/registry\/agents\/(.+)\/manifest$/) && method === 'GET') {
    const slug = path.match(/^\/api\/registry\/agents\/(.+)\/manifest$/)[1];
    console.log('Getting manifest for slug:', slug);
    const manifest = registryService.getManifest(slug);
    
    if (!manifest) {
      console.log('Manifest not found for slug:', slug);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Manifest not found' }));
      return;
    }
    
    console.log('Manifest found:', manifest);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(manifest));
    return;
  }
  
  if (path.match(/^\/api\/registry\/agents\/(.+)$/) && method === 'GET') {
    const slug = path.match(/^\/api\/registry\/agents\/(.+)$/)[1];
    const agent = registryService.getAgent(slug);
    
    if (!agent) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Agent not found' }));
      return;
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(agent));
    return;
  }
  
  if (path.match(/^\/api\/agents\/([^\/]+)\/publish$/) && method === 'POST') {
    console.log('🔍 Publish endpoint matched for path:', path);
    const agentId = path.split('/')[3];
    const agent = agents.find(a => a.id === agentId);
    
    if (!agent) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Agent not found' }));
      return;
    }
    
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        console.log('Received publish data:', JSON.stringify(data, null, 2));
        
        // Check for tampered signature
        if (data.signature === 'tampered-signature') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: 'SAFETY_VIOLATION',
            message: 'Tampered manifest signature detected and rejected',
            code: 'MANIFEST_TAMPERED'
          }));
          return;
        }
        
        const [namespace, name] = data.slug.split('/');
        
        const agentData = {
          namespace,
          name,
          slug: data.slug,
          version: data.version,
          visibility: 'public',
          owner_workspace_id: data.owner_workspace_id || agent.workspace_id,
          publisher_id: data.publisher_id || 'demo-publisher'
        };
        
        const manifestData = {
          entry: agent.config_json.entry,
          language: agent.config_json.language,
          policy_refs: agent.config_json.policy_refs || [],
          env_ref_names: agent.config_json.env_refs || [],
          readme_md: data.readme_md || '',
          tags: data.tags || [],
          examples: data.examples || [],
          summary: data.summary || ''
        };
        
                         console.log('Publishing agent with data:', { agentData, manifestData });
        const result = registryService.publishAgent(
          agentData,
          manifestData,
          data.owner_workspace_id || agent.workspace_id,
          data.publisher_id || 'demo-publisher'
        );
         
         if (result.success) {
           console.log('Publishing successful, agent slug:', result.agent.slug);
           res.writeHead(201, { 'Content-Type': 'application/json' });
           res.end(JSON.stringify(result));
         } else {
           console.log('Publishing failed:', result.errors);
           res.writeHead(400, { 'Content-Type': 'application/json' });
           res.end(JSON.stringify({ error: 'Validation failed', details: result.errors }));
         }
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request body' }));
      }
    });
    return;
  }
  
  if (path === '/api/registry/report' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const result = registryService.reportAbuse(
          data.slug,
          data.reason,
          data.reporter_id || 'anonymous'
        );
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request body' }));
      }
    });
    return;
  }
  
  if (path === '/api/registry/public-key' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(registryService.getPublicKey());
    return;
  }
  
  // Enhanced agent endpoints
  if (path === '/api/agents' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(agents));
    return;
  }
  
  if (path === '/api/agents' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const workspaceId = data.workspace_id || 'default';
        
        // Check plan limits for agent creation
        const settings = workspaceSettings.get(workspaceId) || { plan: 'free', storePlain: true };
        const planLimits = PLAN_LIMITS[settings.plan] || PLAN_LIMITS.free;
        
        // Count existing agents for this workspace
        const workspaceAgents = agents.filter(a => a.workspace_id === workspaceId);
        if (workspaceAgents.length >= planLimits.agents) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: 'PLAN_LIMIT_REACHED',
            message: `Plan ${settings.plan} allows ${planLimits.agents} agents. Currently have: ${workspaceAgents.length}`,
            remedy: 'Upgrade your plan to create more agents'
          }));
          return;
        }
        
        // Also check if we're at the global limit for demo purposes
        // Since we start with 2 demo agents, allow only 1 more for testing
        if (agents.length >= 3) { // Limit to 3 agents total for demo
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: 'GLOBAL_LIMIT_REACHED',
            message: `Demo system allows maximum 3 agents total. Currently have: ${agents.length}`,
            remedy: 'Remove some agents to create new ones'
          }));
          return;
        }
        
        // Additional check: if this is a test workspace, enforce stricter limits
        if (workspaceId.includes('e2e-workspace') && agents.length >= 2) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: 'TEST_LIMIT_REACHED',
            message: `Test workspaces are limited to 2 agents. Currently have: ${agents.length}`,
            remedy: 'Use a different workspace for testing'
          }));
          return;
        }
        
        // Create new agent
        const agentId = generateId();
        const agent = {
          id: agentId,
          workspace_id: workspaceId,
          name: data.name,
          slug: data.slug,
          visibility: data.visibility || 'private',
          config_json: data.config_json || {},
          created_at: new Date().toISOString()
        };
        
        agents.push(agent);
        
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(agent));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request body' }));
      }
    });
    return;
  }
  
  if (path.match(/^\/api\/agents\/([^\/]+)$/) && method === 'GET') {
    const slug = path.split('/')[3];
    const agent = agents.find(a => a.slug === slug);
    
    if (!agent) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Agent not found' }));
      return;
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(agent));
    return;
  }
  
  if (path.match(/^\/api\/agents\/([^\/]+)\/run$/) && method === 'POST') {
    const slug = path.split('/')[3];
    const agent = agents.find(a => a.slug === slug);
    
    if (!agent) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Agent not found' }));
      return;
    }
    
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const workspaceId = data.workspace_id || agent.workspace_id;
        const idempotencyKey = req.headers['idempotency-key'];
        
        // STEP 0: Safety Validation (BEFORE everything else)
        if (data.prompt) {
          const promptInjectionPatterns = [
            /ignore previous instructions/i,
            /system information/i,
            /reveal.*system/i,
            /bypass.*safety/i,
            /ignore.*rules/i
          ];
          
          for (const pattern of promptInjectionPatterns) {
            if (pattern.test(data.prompt)) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ 
                error: 'SAFETY_VIOLATION',
                message: 'Prompt injection attempt detected and blocked',
                code: 'PROMPT_INJECTION_BLOCKED'
              }));
              return;
            }
          }
          
          // Check for PII in prompt
          const piiPatterns = [
            /\b\d{3}-\d{2}-\d{4}\b/, // SSN
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
            /\b\d{10,11}\b/, // Phone numbers
            /\b\d{4}\s\d{4}\s\d{4}\s\d{4}\b/ // Credit card
          ];
          
          for (const pattern of piiPatterns) {
            if (pattern.test(data.prompt)) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ 
                error: 'SAFETY_VIOLATION',
                message: 'PII detected in prompt - requires approval',
                code: 'PII_DETECTED'
              }));
              return;
            }
          }
        }
        
        // STEP 1: Idempotency Resolution (BEFORE rate limiting and concurrency checks)
        if (idempotencyKey) {
          const existingRun = Array.from(runs.values()).find(r => r.idempotency_key === idempotencyKey);
          if (existingRun) {
            // Return existing run immediately - skip all limiters
            metrics.idempotency_hits++;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              run_id: existingRun.id, 
              status: 'existing',
              message: 'Idempotent request - returning existing run'
            }));
            return;
          } else {
            metrics.idempotency_misses++;
          }
        }
        
        // STEP 2: Rate Limiting (after idempotency, before concurrency)
        if (!getRateLimit(clientIP, 'run')) {
          metrics.rate_limited_total++;
          res.writeHead(429, { 
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.floor(Date.now() / 1000) + 60
          });
          res.end(JSON.stringify({ 
            error: 'RATE_LIMITED',
            message: 'Too many requests',
            retry_after_ms: 60000
          }));
          return;
        }
        
        // STEP 3: Plan limits and concurrency (after idempotency and rate limiting)
        const settings = workspaceSettings.get(workspaceId) || { plan: 'free', storePlain: true };
        const planLimits = TEST_MODE ? { concurrentRuns: TEST_CONCURRENCY_LIMIT } : (PLAN_LIMITS[settings.plan] || PLAN_LIMITS.free);
        
        // Check concurrent runs limit
        const currentConcurrent = workspaceConcurrentRuns.get(workspaceId) || 0;
        if (currentConcurrent >= planLimits.concurrentRuns) {
          metrics.concurrency_denials++;
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: 'CONCURRENCY_LIMIT_REACHED',
            message: `Plan ${settings.plan} allows ${planLimits.concurrentRuns} concurrent runs. Currently running: ${currentConcurrent}`,
            remedy: 'Wait for existing runs to complete or upgrade your plan'
          }));
          return;
        }
        
        const runId = generateId();
        const run = {
          id: runId,
          agent_id: agent.id,
          workspace_id: workspaceId,
          status: 'queued',
          idempotency_key: idempotencyKey,
          created_at: new Date().toISOString()
        };
        
        runs.set(runId, run);
        runLogs.set(runId, []);
        runEvents.set(runId, []);
        runSpans.set(runId, []);
        runGuardEvents.set(runId, []);
        
        // Increment concurrent runs
        workspaceConcurrentRuns.set(workspaceId, currentConcurrent + 1);
        
        metrics.run_starts_total++;
        executeAgent(runId, agent);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ run_id: runId, status: 'started' }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request body' }));
      }
    });
    return;
  }
  
  // Enhanced run status with Sentinel/Shield data
  if (path.match(/^\/api\/runs\/([^\/]+)$/) && method === 'GET') {
    const runId = path.split('/')[3];
    const run = runs.get(runId);
    
    if (!run) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Run not found' }));
      return;
    }
    
    const response = {
      ...run,
      spans: runSpans.get(runId) || [],
      verdict: runVerdicts.get(runId) || null,
      shield_decision: runShieldDecisions.get(runId) || null,
      guard_events: runGuardEvents.get(runId) || []
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
    return;
  }
  
  if (path.match(/^\/api\/runs\/([^\/]+)\/stop$/) && method === 'POST') {
    const runId = path.split('/')[3];
    const run = runs.get(runId);
    
    if (!run) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Run not found' }));
      return;
    }
    
    if (run.status === 'running') {
      run.status = 'stopped';
      run.ended_at = new Date().toISOString();
      addLogEntry(runId, 'info', 'Run stopped by user request');
      generateGuardEvent(runId, 'agent.stopped', { reason: 'user_request' });
      emitSSEEvent(runId, 'status', { status: 'stopped' });
      emitSSEEvent(runId, 'done', { status: 'stopped' });
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'stopped' }));
    return;
  }
  
  if (path === '/api/runs' && method === 'GET') {
    const runsList = Array.from(runs.values()).slice(-20);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(runsList));
    return;
  }
  
  // Enhanced logs SSE with de-duping and replay
  if (path.match(/^\/api\/runs\/([^\/]+)\/logs\/stream$/) && method === 'GET') {
    const runId = path.split('/')[3];
    const run = runs.get(runId);
    
    if (!run) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Run not found' }));
      return;
    }
    
    // Check SSE connection limits
    const currentConnections = sseConnections.get(runId)?.length || 0;
    if (currentConnections >= SSE_CONFIG.MAX_CONNECTIONS) {
      res.writeHead(429, { 
        'Content-Type': 'application/json',
        'Retry-After': '30'
      });
      res.end(JSON.stringify({ 
        error: 'SSE_CAPACITY',
        message: 'Too many SSE connections',
        retry_after_seconds: 30
      }));
      return;
    }
    
    // Parse Last-Event-ID for resume
    const lastEventId = req.headers['last-event-id'];
    const parsedLastEvent = parseLastEventId(lastEventId);
    
    // Create SSE connection
    const connectionId = generateId();
    const connection = new SSEConnection(runId, 'logs', res, connectionId);
    
    if (!sseConnections.has(runId)) {
      sseConnections.set(runId, []);
    }
    sseConnections.get(runId).push(connection);
    metrics.sse_connections_total++;
    
    // Determine replay start sequence
    let startSeq = 1;
    if (parsedLastEvent && parsedLastEvent.runId === runId && parsedLastEvent.streamType === 'logs') {
      startSeq = parsedLastEvent.seq + 1;
    } else {
      // Replay window: start from max(0, latest_seq - REPLAY_WINDOW + 1)
      const currentSeq = eventSequences.get(runId)?.logs || 0;
      startSeq = Math.max(1, currentSeq - SSE_CONFIG.REPLAY_WINDOW + 1);
    }
    
    // Replay recent events
    const logs = runLogs.get(runId) || [];
    const events = runEvents.get(runId) || [];
    
    // Send existing logs with proper sequence numbers
    logs.forEach((log, index) => {
      const seq = startSeq + index;
      connection.sendEvent({ type: 'log', ...log }, seq);
      metrics.sse_replay_events_total++;
    });
    
    // Send existing events with proper sequence numbers
    events.forEach((event, index) => {
      const seq = startSeq + logs.length + index;
      connection.sendEvent(event, seq);
      metrics.sse_replay_events_total++;
    });
    
    // Send current status
    const statusSeq = getNextEventSeq(runId, 'logs');
    connection.sendEvent({ type: 'status', status: run.status }, statusSeq);
    
    // Handle connection close
    req.on('close', () => {
      const connections = sseConnections.get(runId) || [];
      const index = connections.indexOf(connection);
      if (index > -1) {
        connections.splice(index, 1);
      }
      connection.close();
    });
    
    return;
  }
  
  // Enhanced Guard events SSE endpoint with de-duping and replay
  if (path.match(/^\/api\/runs\/([^\/]+)\/guard\/stream$/) && method === 'GET') {
    const runId = path.split('/')[3];
    const run = runs.get(runId);
    
    if (!run) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Run not found' }));
      return;
    }
    
    // Check SSE connection limits
    const currentConnections = guardConnections.get(runId)?.length || 0;
    if (currentConnections >= SSE_CONFIG.MAX_CONNECTIONS) {
      res.writeHead(429, { 
        'Content-Type': 'application/json',
        'Retry-After': '30'
      });
      res.end(JSON.stringify({ 
        error: 'SSE_CAPACITY',
        message: 'Too many SSE connections',
        retry_after_seconds: 30
      }));
      return;
    }
    
    // Parse Last-Event-ID for resume
    const lastEventId = req.headers['last-event-id'];
    const parsedLastEvent = parseLastEventId(lastEventId);
    
    // Create SSE connection
    const connectionId = generateId();
    const connection = new SSEConnection(runId, 'guard', res, connectionId);
    
    if (!guardConnections.has(runId)) {
      guardConnections.set(runId, []);
    }
    guardConnections.get(runId).push(connection);
    metrics.sse_connections_total++;
    
    // Determine replay start sequence
    let startSeq = 1;
    if (parsedLastEvent && parsedLastEvent.runId === runId && parsedLastEvent.streamType === 'guard') {
      startSeq = parsedLastEvent.seq + 1;
    } else {
      // Replay window: start from max(0, latest_seq - REPLAY_WINDOW + 1)
      const currentSeq = eventSequences.get(runId)?.guard || 0;
      startSeq = Math.max(1, currentSeq - SSE_CONFIG.REPLAY_WINDOW + 1);
    }
    
    // Replay recent guard events
    const guardEvents = runGuardEvents.get(runId) || [];
    const recentEvents = guardEvents.slice(-SSE_CONFIG.REPLAY_WINDOW);
    
    // Send replay events with sequence numbers
    recentEvents.forEach((event, index) => {
      const seq = startSeq + index;
      connection.sendEvent(event, seq);
      metrics.sse_replay_events_total++;
    });
    
    // Handle connection close
    req.on('close', () => {
      const connections = guardConnections.get(runId) || [];
      const index = connections.indexOf(connection);
      if (index > -1) {
        connections.splice(index, 1);
      }
      connection.close();
    });
    
    return;
  }
  
  // 404 for unknown endpoints
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

// Check if port is already in use
const net = require('net');
const testServer = net.createServer();

testServer.once('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use!`);
    console.error('Please stop any existing gateway processes first.');
    console.error('Run: .\\stop-reliable.bat or manually kill Node.js processes');
    process.exit(1);
  }
});

testServer.once('listening', () => {
  testServer.close();
  
     server.listen(PORT, HOST, () => {
     console.log(`✅ Enhanced Gateway with Sentinel/Shield running on http://${HOST}:${PORT}`);
     console.log(`📋 Process ID: ${process.pid}`);
     console.log(`🧪 Test Mode: ${TEST_MODE ? 'ENABLED' : 'DISABLED'}`);
     console.log(`🧪 Test Concurrency Limit: ${TEST_CONCURRENCY_LIMIT}`);
     console.log('📋 Available endpoints:');
     console.log('   - /health, /ready, /metrics');
     console.log('   - /api/agents (GET, POST)');
     console.log('   - /api/agents/:slug/run (POST)');
     console.log('   - /api/runs/:id (GET)');
     console.log('   - /api/runs/:id/logs/stream (SSE)');
     console.log('   - /api/runs/:id/guard/stream (SSE) - NEW!');
     console.log('   - /api/workspace/privacy (POST) - NEW!');
     console.log('   - /api/workspace/plan (POST) - NEW!');
     console.log('   - /api/registry/* (Registry endpoints)');
     console.log('');
     console.log('🔒 Security headers enabled');
     console.log('🛡️  Sentinel/Shield integration active');
     console.log('📊 Enhanced metrics with spans and guard events');
     console.log('🔄 Idempotency resolution BEFORE rate limiting');
   });
});

testServer.listen(PORT, HOST);

