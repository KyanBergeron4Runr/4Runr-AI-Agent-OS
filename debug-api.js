const http = require('http');

function makeRequest(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-Workspace-ID': 'test-workspace-debug'
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

async function debugAPI() {
    console.log('=== Debugging API Responses ===\n');
    
    // Test health endpoint
    console.log('1. Testing /health:');
    const health = await makeRequest('/health');
    console.log('Status:', health.status);
    console.log('Data:', JSON.stringify(health.data, null, 2));
    console.log();
    
    // Test agents endpoint
    console.log('2. Testing /api/agents:');
    const agents = await makeRequest('/api/agents');
    console.log('Status:', agents.status);
    console.log('Data:', JSON.stringify(agents.data, null, 2));
    console.log();
    
    // Test creating an agent
    console.log('3. Testing POST /api/agents:');
    const agentData = {
        workspace_id: 'test-workspace-debug',
        name: 'Debug Agent',
        slug: 'debug-agent',
        visibility: 'private',
        manifest_version: '1.0',
        config_json: {
            entry: 'index.js',
            language: 'node',
            env_refs: [],
            policy_refs: ['default'],
            resources: { cpu: '100m', memory: '128Mi' }
        }
    };
    const createAgent = await makeRequest('/api/agents', 'POST', agentData);
    console.log('Status:', createAgent.status);
    console.log('Data:', JSON.stringify(createAgent.data, null, 2));
    console.log();
    
    // Test starting a run
    if (createAgent.data && createAgent.data.id) {
        console.log('4. Testing POST /api/agents/:id/run:');
        const runData = {
            workspace_id: 'test-workspace-debug',
            input: { message: 'Debug test' }
        };
        const startRun = await makeRequest(`/api/agents/${createAgent.data.id}/run`, 'POST', runData);
        console.log('Status:', startRun.status);
        console.log('Data:', JSON.stringify(startRun.data, null, 2));
        console.log();
        
        // Test getting run status
        if (startRun.data && startRun.data.run_id) {
            console.log('5. Testing GET /api/runs/:id:');
            const runStatus = await makeRequest(`/api/runs/${startRun.data.run_id}`);
            console.log('Status:', runStatus.status);
            console.log('Data:', JSON.stringify(runStatus.data, null, 2));
            console.log();
        }
    }
}

debugAPI().catch(console.error);
