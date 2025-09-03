const http = require('http');
const url = require('url');
const { spawn } = require('child_process');
const crypto = require('crypto');
const RegistryService = require('./registry-service');

console.log('🚀 Starting 4Runr Gateway with Registry...');

// Initialize registry service
const registryService = new RegistryService();

// In-memory storage for demo (in production, this would be database)
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

const runs = new Map();
const runLogs = new Map();
const runEvents = new Map();
const activeProcesses = new Map();
const sseConnections = new Map();

// Helper functions
const generateId = () => crypto.randomUUID();
const sanitizeLog = (message) => {
  return message
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]')
    .replace(/sk-[A-Za-z0-9]{48}/g, '[API_KEY]')
    .replace(/pk-[A-Za-z0-9]{48}/g, '[API_KEY]');
};

const emitSSEEvent = (runId, eventType, data) => {
  const connections = sseConnections.get(runId) || [];
  const event = {
    type: eventType,
    timestamp: new Date().toISOString(),
    ...data
  };
  
  if (eventType === 'guard') {
    if (!runEvents.has(runId)) {
      runEvents.set(runId, []);
    }
    runEvents.get(runId).push(event);
  }
  
  connections.forEach(connection => {
    connection.write(`data: ${JSON.stringify(event)}\n\n`);
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

const executeAgent = async (runId, agent) => {
  const run = runs.get(runId);
  if (!run) return;
  
  try {
    run.status = 'running';
    run.started_at = new Date().toISOString();
    emitSSEEvent(runId, 'status', { status: 'running' });
    
    addLogEntry(runId, 'info', `Starting agent: ${agent.name} (${agent.slug})`);
    
    const config = agent.config_json;
    addLogEntry(runId, 'info', `Entry point: ${config.entry}`);
    addLogEntry(runId, 'info', `Language: ${config.language}`);
    
    setTimeout(() => {
      addLogEntry(runId, 'info', 'Agent initialized successfully');
      emitSSEEvent(runId, 'guard', { 
        event_type: 'sentinel.heartbeat',
        severity: 'info',
        message: 'Agent started'
      });
    }, 1000);
    
    setTimeout(() => {
      addLogEntry(runId, 'info', 'Processing data...');
      emitSSEEvent(runId, 'guard', {
        event_type: 'shield.decision',
        severity: 'info',
        action: 'allow',
        message: 'Output validated'
      });
    }, 3000);
    
    setTimeout(() => {
      addLogEntry(runId, 'info', 'Agent completed successfully');
      run.status = 'complete';
      run.ended_at = new Date().toISOString();
      run.duration_ms = Date.now() - new Date(run.started_at).getTime();
      run.sentinel_stats = {
        spans_total: 3,
        guard_events_total: 2,
        shield_decisions_total: 1
      };
      
      emitSSEEvent(runId, 'status', { status: 'complete' });
      emitSSEEvent(runId, 'done', { 
        status: 'complete',
        duration_ms: run.duration_ms
      });
    }, 5000);
    
  } catch (error) {
    addLogEntry(runId, 'error', `Agent execution failed: ${error.message}`);
    run.status = 'failed';
    run.ended_at = new Date().toISOString();
    
    emitSSEEvent(runId, 'guard', {
      type: 'agent.error',
      severity: 'error',
      message: 'Agent execution failed'
    });
    emitSSEEvent(runId, 'status', { status: 'failed' });
    emitSSEEvent(runId, 'done', { status: 'failed' });
  }
};

// Create HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;
  const query = parsedUrl.query;
  
  // Get client IP for rate limiting
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '127.0.0.1';
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');
  
  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Health endpoint
  if (path === '/health' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      version: '1.0.0',
      time: new Date().toISOString()
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
  
  // Metrics endpoint
  if (path === '/metrics' && method === 'GET') {
    const activeRuns = Array.from(runs.values()).filter(r => r.status === 'running').length;
    const totalRuns = runs.size;
    const totalLogs = Array.from(runLogs.values()).reduce((sum, logs) => sum + logs.length, 0);
    const registryMetrics = registryService.getMetrics();
    
    const metrics = [
      '# HELP sentinel_spans_total Total number of Sentinel spans',
      '# TYPE sentinel_spans_total counter',
      `sentinel_spans_total ${totalRuns * 3}`,
      '',
      '# HELP sentinel_guard_events_total Total number of Guard events',
      '# TYPE sentinel_guard_events_total counter',
      `sentinel_guard_events_total ${totalRuns * 2}`,
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
      `registry_workspaces_total ${registryMetrics.registry_workspaces_total}`
    ].join('\n');
    
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(metrics);
    return;
  }
  
  // Registry endpoints
  if (path === '/api/registry/agents' && method === 'GET') {
    // Rate limiting
    if (!registryService.checkRateLimit(clientIP, 'search')) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
      return;
    }
    
    const results = registryService.searchAgents(query.q, {
      owner: query.owner,
      tag: query.tag
    });
    
    // Apply pagination
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
  
  // Get agent details
  if (path.match(/^\/api\/registry\/agents\/([^\/]+)$/) && method === 'GET') {
    const slug = path.split('/')[4];
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
  
  // Get manifest
  if (path.match(/^\/api\/registry\/agents\/([^\/]+)\/manifest$/) && method === 'GET') {
    const slug = path.split('/')[4];
    const manifest = registryService.getManifest(slug);
    
    if (!manifest) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Manifest not found' }));
      return;
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(manifest));
    return;
  }
  
  // Publish agent
  if (path.match(/^\/api\/agents\/([^\/]+)\/publish$/) && method === 'POST') {
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
        
        // Extract namespace and name from slug
        const [namespace, name] = data.slug.split('/');
        
        const agentData = {
          namespace,
          name,
          slug: data.slug,
          version: data.version,
          visibility: 'public'
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
        
        const result = registryService.publishAgent(
          agentData,
          manifestData,
          agent.workspace_id,
          data.publisher_id || 'demo-publisher'
        );
        
        if (result.success) {
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } else {
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
  
  // Report abuse
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
  
  // Get registry public key
  if (path === '/api/registry/public-key' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(registryService.getPublicKey());
    return;
  }
  
  // Original gateway endpoints (existing functionality)
  if (path === '/api/agents' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(agents));
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
        const idempotencyKey = req.headers['idempotency-key'];
        
        if (idempotencyKey) {
          const existingRun = Array.from(runs.values()).find(r => r.idempotency_key === idempotencyKey);
          if (existingRun) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ run_id: existingRun.id, status: 'existing' }));
            return;
          }
        }
        
        const runId = generateId();
        const run = {
          id: runId,
          agent_id: agent.id,
          workspace_id: agent.workspace_id,
          status: 'queued',
          idempotency_key: idempotencyKey,
          created_at: new Date().toISOString()
        };
        
        runs.set(runId, run);
        runLogs.set(runId, []);
        runEvents.set(runId, []);
        
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
  
  if (path.match(/^\/api\/runs\/([^\/]+)$/) && method === 'GET') {
    const runId = path.split('/')[3];
    const run = runs.get(runId);
    
    if (!run) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Run not found' }));
      return;
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(run));
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
  
  if (path.match(/^\/api\/runs\/([^\/]+)\/logs\/stream$/) && method === 'GET') {
    const runId = path.split('/')[3];
    const run = runs.get(runId);
    
    if (!run) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Run not found' }));
      return;
    }
    
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    
    if (!sseConnections.has(runId)) {
      sseConnections.set(runId, []);
    }
    sseConnections.get(runId).push(res);
    
    const logs = runLogs.get(runId) || [];
    const recentLogs = logs.slice(-200);
    
    recentLogs.forEach(log => {
      res.write(`data: ${JSON.stringify({ type: 'log', ...log })}\n\n`);
    });
    
    const events = runEvents.get(runId) || [];
    events.forEach(event => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });
    
    res.write(`data: ${JSON.stringify({ type: 'status', status: run.status })}\n\n`);
    
    req.on('close', () => {
      const connections = sseConnections.get(runId) || [];
      const index = connections.indexOf(res);
      if (index > -1) {
        connections.splice(index, 1);
      }
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
    console.log(`✅ Enhanced Gateway with Registry running on http://${HOST}:${PORT}`);
    console.log(`📋 Process ID: ${process.pid}`);
    console.log('📋 Available endpoints:');
    console.log('   GET  /health                           - Health check');
    console.log('   GET  /ready                            - Readiness check');
    console.log('   GET  /metrics                          - Prometheus metrics');
    console.log('   GET  /api/agents                       - List agents');
    console.log('   GET  /api/agents/:slug                 - Get agent by slug');
    console.log('   POST /api/agents/:slug/run             - Start agent run');
    console.log('   GET  /api/runs                         - List runs');
    console.log('   GET  /api/runs/:id                     - Get run status');
    console.log('   POST /api/runs/:id/stop                - Stop run');
    console.log('   GET  /api/runs/:id/logs/stream         - Stream logs (SSE)');
    console.log('   GET  /api/registry/agents              - Search registry');
    console.log('   GET  /api/registry/agents/:slug        - Get registry agent');
    console.log('   GET  /api/registry/agents/:slug/manifest - Get signed manifest');
    console.log('   POST /api/agents/:id/publish           - Publish agent');
    console.log('   POST /api/registry/report              - Report abuse');
    console.log('   GET  /api/registry/public-key          - Get registry public key');
    console.log('');
    console.log('🛑 Press Ctrl+C to stop the gateway');
  });
});

testServer.listen(PORT, HOST);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Enhanced Gateway...');
  
  activeProcesses.forEach((process, runId) => {
    try {
      process.kill();
    } catch (error) {
      console.log(`Error stopping process for run ${runId}:`, error.message);
    }
  });
  
  server.close(() => {
    console.log('✅ Enhanced Gateway stopped');
    process.exit(0);
  });
});
