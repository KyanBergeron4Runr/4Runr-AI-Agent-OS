#!/usr/bin/env node

/**
 * Mock Gateway Server
 * 
 * Purpose: Provide a simple mock Gateway for testing the S2 harness
 * without needing the full Gateway setup
 */

const http = require('http');
const url = require('url');

const PORT = 3000;

// Mock data store
const mockData = {
  runs: new Map(),
  workspaces: new Map(),
  sseClients: new Set(),
  sseMessages: 0, // Track total messages sent
  sseConnections: 0 // Track total connections made
};

// Generate mock run data
function generateMockRun(id, name, workspaceId) {
  return {
    id,
    name,
    workspace_id: workspaceId,
    status: 'created',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

// Parse request body
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        resolve({});
      }
    });
  });
}

// Create response
function createResponse(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Workspace-ID, X-Test-Bypass, Last-Event-ID'
  });
  res.end(JSON.stringify(data));
}

// Handle SSE connections with proper metrics
function handleSSE(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Workspace-ID, X-Test-Bypass, Last-Event-ID'
  });

  const clientId = `sse-${Date.now()}-${Math.random()}`;
  mockData.sseClients.add(clientId);
  mockData.sseConnections++;

  // Handle Last-Event-ID for resume support
  let seq = 1;
  const lastEventId = req.headers['last-event-id'];
  if (lastEventId && !isNaN(Number(lastEventId))) {
    seq = Number(lastEventId) + 1;
  }

  // Send initial connection event
  res.write(`id: ${seq++}\n`);
  res.write(`data: {"type": "connected", "clientId": "${clientId}"}\n\n`);
  mockData.sseMessages++;

  // Send periodic heartbeat
  const heartbeat = setInterval(() => {
    res.write(`id: ${seq++}\n`);
    res.write(`data: {"type": "heartbeat", "timestamp": "${new Date().toISOString()}"}\n\n`);
    mockData.sseMessages++;
  }, 5000); // Changed to 5 seconds for more frequent heartbeats

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    mockData.sseClients.delete(clientId);
    console.log(`🔌 SSE client ${clientId} disconnected. Active: ${mockData.sseClients.size}`);
  });

  console.log(`🔌 SSE client ${clientId} connected. Active: ${mockData.sseClients.size}`);
}

// Main request handler
async function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Workspace-ID, X-Test-Bypass, Last-Event-ID'
    });
    res.end();
    return;
  }

  try {
    // Health check
    if (path === '/health' && method === 'GET') {
      return createResponse(res, 200, { status: 'healthy', timestamp: new Date().toISOString() });
    }

    // Ready check
    if (path === '/ready' && method === 'GET') {
      return createResponse(res, 200, { status: 'ready', timestamp: new Date().toISOString() });
    }

    // Metrics with proper SSE tracking
    if (path === '/metrics' && method === 'GET') {
      const metrics = {
        runs_total: mockData.runs.size,
        sse_active_connections: mockData.sseClients.size, // Proper gauge name
        sse_messages_total: mockData.sseMessages, // Total messages sent
        sse_connections_total: mockData.sseConnections, // Total connections made
        rate_limit_requests_total: 0,
        rate_limit_rejected_total: 0,
        concurrency_rejected_total: 0,
        auth_failures_total: 0
      };
      return createResponse(res, 200, metrics);
    }

    // Workspace plan
    if (path === '/api/workspace/plan' && method === 'POST') {
      const body = await parseBody(req);
      if (body.plan) {
        mockData.workspaces.set(body.workspace_id || 'default', { plan: body.plan });
        return createResponse(res, 200, { success: true, plan: body.plan });
      }
      return createResponse(res, 400, { error: 'Invalid plan' });
    }

    // Create run
    if (path === '/api/runs' && method === 'POST') {
      const body = await parseBody(req);
      const runId = body.id || `run-${Date.now()}`;
      const run = generateMockRun(runId, body.name, body.workspace_id);
      mockData.runs.set(runId, run);
      return createResponse(res, 201, run);
    }

    // Get run
    if (path.match(/^\/api\/runs\/[^\/]+$/) && method === 'GET') {
      const runId = path.split('/')[3];
      const run = mockData.runs.get(runId);
      if (run) {
        return createResponse(res, 200, run);
      }
      return createResponse(res, 404, { error: 'Run not found' });
    }

    // Start run
    if (path.match(/^\/api\/runs\/[^\/]+\/start$/) && method === 'POST') {
      const runId = path.split('/')[3];
      const run = mockData.runs.get(runId);
      if (run) {
        run.status = 'running';
        run.updated_at = new Date().toISOString();
        
        // Simulate run completion after 5 seconds
        setTimeout(() => {
          run.status = 'completed';
          run.updated_at = new Date().toISOString();
        }, 5000);
        
        return createResponse(res, 200, run);
      }
      return createResponse(res, 404, { error: 'Run not found' });
    }

    // SSE endpoints
    if (path === '/api/runs/logs/stream' && method === 'GET') {
      return handleSSE(req, res);
    }

    if (path === '/diagnostics/sse-test' && method === 'GET') {
      return handleSSE(req, res);
    }

    // Registry publish
    if (path === '/api/registry/publish' && method === 'POST') {
      const body = await parseBody(req);
      return createResponse(res, 201, { 
        success: true, 
        name: body.name, 
        version: body.version,
        published_at: new Date().toISOString()
      });
    }

    // Safety check
    if (path === '/api/safety/check' && method === 'GET') {
      return createResponse(res, 200, { 
        status: 'safe', 
        timestamp: new Date().toISOString() 
      });
    }

    // Privacy toggle
    if (path === '/api/privacy/toggle' && method === 'POST') {
      const body = await parseBody(req);
      return createResponse(res, 200, { 
        success: true, 
        storePlain: body.storePlain,
        updated_at: new Date().toISOString()
      });
    }

    // Chaos endpoints (for testing)
    if (path === '/api/chaos/redis-restart' && method === 'POST') {
      return createResponse(res, 200, { message: 'Redis restart simulated' });
    }

    if (path === '/api/chaos/gateway-restart' && method === 'POST') {
      return createResponse(res, 200, { message: 'Gateway restart simulated' });
    }

    if (path === '/api/chaos/latency' && method === 'POST') {
      const body = await parseBody(req);
      return createResponse(res, 200, { 
        message: `Latency injection simulated: ${body.delay}ms` 
      });
    }

    // Default 404
    return createResponse(res, 404, { error: 'Not found', path, method });

  } catch (error) {
    console.error('Error handling request:', error);
    return createResponse(res, 500, { error: 'Internal server error' });
  }
}

// Create server
const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`🚀 Mock Gateway running on http://localhost:${PORT}`);
  console.log('📋 Available endpoints:');
  console.log('  GET  /health');
  console.log('  GET  /ready');
  console.log('  GET  /metrics');
  console.log('  POST /api/workspace/plan');
  console.log('  POST /api/runs');
  console.log('  GET  /api/runs/:id');
  console.log('  POST /api/runs/:id/start');
  console.log('  GET  /api/runs/logs/stream (SSE)');
  console.log('  GET  /diagnostics/sse-test (SSE)');
  console.log('  POST /api/registry/publish');
  console.log('  GET  /api/safety/check');
  console.log('  POST /api/privacy/toggle');
  console.log('  POST /api/chaos/* (for testing)');
  console.log('');
  console.log('Press Ctrl+C to stop');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Mock Gateway...');
  server.close(() => {
    console.log('✅ Mock Gateway stopped');
    process.exit(0);
  });
});
