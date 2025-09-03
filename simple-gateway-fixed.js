const http = require('http');
const url = require('url');

// In-memory storage
const runs = new Map();
const sseClients = new Set();
let runCounter = 0;
let sseMessageCounter = 0;

// Simple logger
const log = (msg, data = '') => console.log(`[${new Date().toISOString()}] ${msg}`, data);

// Create HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Workspace-ID, Last-Event-ID');

  // Handle preflight
  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Helper to send JSON response
  const sendJson = (statusCode, data) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  log(`${method} ${path}`);

  // Health endpoint
  if (path === '/health' && method === 'GET') {
    return sendJson(200, {
      ok: true,
      version: '1.0.0',
      time: new Date().toISOString()
    });
  }

  // Ready endpoint
  if (path === '/ready' && method === 'GET') {
    return sendJson(200, {
      ready: true,
      timestamp: new Date().toISOString()
    });
  }

  // Metrics endpoint
  if (path === '/metrics' && method === 'GET') {
    const metrics = [
      '# HELP runs_total Total number of runs',
      '# TYPE runs_total counter',
      `runs_total ${runs.size}`,
      '',
      '# HELP sse_active_connections Active SSE connections',
      '# TYPE sse_active_connections gauge',
      `sse_active_connections ${sseClients.size}`,
      '',
      '# HELP sse_messages_total Total SSE messages sent',
      '# TYPE sse_messages_total counter',
      `sse_messages_total ${sseMessageCounter}`,
      '',
      '# HELP sse_connections_total Total SSE connections made',
      '# TYPE sse_connections_total counter',
      `sse_connections_total ${sseClients.size}`
    ].join('\n');

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(metrics);
    return;
  }

  // Workspace plan endpoint
  if (path === '/api/workspace/plan' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        log('Setting workspace plan', { plan: data.plan });
        sendJson(200, {
          success: true,
          plan: data.plan,
          updated_at: new Date().toISOString()
        });
      } catch (e) {
        sendJson(400, { error: 'Invalid JSON' });
      }
    });
    return;
  }

  // Create run endpoint
  if (path === '/api/runs' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const runId = `run-${Date.now()}-${++runCounter}`;
        
        const run = {
          id: runId,
          name: data.name || 'Test Run',
          status: 'created',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          input: data.input || '',
          output: null,
          logs: []
        };
        
        runs.set(runId, run);
        log('Run created', { runId, name: run.name });
        
        sendJson(200, {
          success: true,
          run: run
        });
      } catch (e) {
        sendJson(400, { error: 'Invalid JSON' });
      }
    });
    return;
  }

  // Get run endpoint
  if (path.startsWith('/api/runs/') && method === 'GET') {
    const runId = path.split('/')[3];
    const run = runs.get(runId);
    
    if (!run) {
      return sendJson(404, { error: 'Run not found' });
    }
    
    return sendJson(200, {
      success: true,
      run: run
    });
  }

  // Start run endpoint
  if (path.startsWith('/api/runs/') && path.endsWith('/start') && method === 'POST') {
    const runId = path.split('/')[3];
    const run = runs.get(runId);
    
    if (!run) {
      return sendJson(404, { error: 'Run not found' });
    }
    
    // Update run status
    run.status = 'in-progress';
    run.started_at = new Date().toISOString();
    run.updated_at = new Date().toISOString();
    
    // Simulate run completion after 30 seconds
    setTimeout(() => {
      if (runs.has(runId)) {
        const completedRun = runs.get(runId);
        completedRun.status = 'completed';
        completedRun.completed_at = new Date().toISOString();
        completedRun.updated_at = new Date().toISOString();
        completedRun.output = 'Run completed successfully';
        completedRun.logs.push({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'Run completed'
        });
        log('Run completed', { runId });
      }
    }, 30000);
    
    log('Run started', { runId });
    
    return sendJson(200, {
      success: true,
      run: run
    });
  }

  // SSE endpoint for run logs - FIXED VERSION
  if (path.startsWith('/api/runs/') && path.endsWith('/logs/stream') && method === 'GET') {
    const runId = path.split('/')[3];
    let run = runs.get(runId);
    
    // If run doesn't exist, create a placeholder run for SSE
    if (!run) {
      run = {
        id: runId,
        name: `SSE-Run-${runId}`,
        status: 'created',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        input: '',
        output: null,
        logs: []
      };
      runs.set(runId, run);
      log('Created placeholder run for SSE', { runId });
    }
    
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    const clientId = `sse-${Date.now()}-${Math.random()}`;
    sseClients.add(clientId);
    sseMessageCounter++;
    
    let messageId = 1;
    const lastEventId = req.headers['last-event-id'];
    if (lastEventId && !isNaN(Number(lastEventId))) {
      messageId = Number(lastEventId) + 1;
    }
    
    const sendEvent = (data) => {
      res.write(`id: ${messageId++}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      sseMessageCounter++;
    };

    // Send initial connection event
    sendEvent({
      type: 'connected',
      runId: runId,
      clientId: clientId,
      timestamp: new Date().toISOString()
    });

    // Send run status updates every 5 seconds
    const interval = setInterval(() => {
      const currentRun = runs.get(runId);
      if (currentRun) {
        sendEvent({
          type: 'status_update',
          runId: runId,
          status: currentRun.status,
          timestamp: new Date().toISOString()
        });
      }
    }, 5000);

    // Clean up on disconnect
    req.on('close', () => {
      clearInterval(interval);
      sseClients.delete(clientId);
      log(`SSE client ${clientId} disconnected. Active: ${sseClients.size}`);
    });

    log(`SSE client ${clientId} connected for run ${runId}. Active: ${sseClients.size}`);
    return;
  }

  // Registry publish endpoint
  if (path === '/api/registry/publish' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        log('Registry publish', { name: data.name, version: data.version });
        sendJson(200, {
          success: true,
          name: data.name,
          version: data.version,
          published_at: new Date().toISOString()
        });
      } catch (e) {
        sendJson(400, { error: 'Invalid JSON' });
      }
    });
    return;
  }

  // Safety check endpoint
  if (path === '/api/safety/check' && method === 'GET') {
    return sendJson(200, {
      status: 'safe',
      timestamp: new Date().toISOString()
    });
  }

  // Privacy toggle endpoint
  if (path === '/api/privacy/toggle' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        log('Privacy toggle', { storePlain: data.storePlain });
        sendJson(200, {
          success: true,
          storePlain: data.storePlain,
          updated_at: new Date().toISOString()
        });
      } catch (e) {
        sendJson(400, { error: 'Invalid JSON' });
      }
    });
    return;
  }

  // SSE test endpoint
  if (path === '/diagnostics/sse-test' && method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    const clientId = `sse-test-${Date.now()}-${Math.random()}`;
    sseClients.add(clientId);
    sseMessageCounter++;
    
    let messageId = 1;
    const lastEventId = req.headers['last-event-id'];
    if (lastEventId && !isNaN(Number(lastEventId))) {
      messageId = Number(lastEventId) + 1;
    }

    const sendEvent = (data) => {
      res.write(`id: ${messageId++}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      sseMessageCounter++;
    };

    // Send test events every 2 seconds
    const interval = setInterval(() => {
      sendEvent({
        type: 'test',
        timestamp: new Date().toISOString(),
        message: 'SSE test event'
      });
    }, 2000);

    // Clean up on disconnect
    req.on('close', () => {
      clearInterval(interval);
      sseClients.delete(clientId);
      log(`SSE test client ${clientId} disconnected. Active: ${sseClients.size}`);
    });

    log(`SSE test client ${clientId} connected. Active: ${sseClients.size}`);
    return;
  }

  // 404 for everything else
  sendJson(404, { error: 'Not found' });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

server.listen(PORT, HOST, () => {
  log(`🚀 Fixed Gateway running on http://${HOST}:${PORT}`);
  log('📋 Available endpoints:');
  log('  GET  /health');
  log('  GET  /ready');
  log('  GET  /metrics');
  log('  POST /api/workspace/plan');
  log('  POST /api/runs');
  log('  GET  /api/runs/:id');
  log('  POST /api/runs/:id/start');
  log('  GET  /api/runs/:id/logs/stream (SSE) - Creates placeholder runs');
  log('  GET  /diagnostics/sse-test (SSE)');
  log('  POST /api/registry/publish');
  log('  GET  /api/safety/check');
  log('  POST /api/privacy/toggle');
  log('Press Ctrl+C to stop');
});

// Graceful shutdown
process.on('SIGINT', () => {
  log('🛑 Shutting down Fixed Gateway...');
  server.close(() => {
    log('✅ Fixed Gateway stopped');
    process.exit(0);
  });
});
