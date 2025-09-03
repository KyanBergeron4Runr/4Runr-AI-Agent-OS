#!/usr/bin/env node

const http = require('http');
const readline = require('readline');

const API_BASE = 'http://localhost:3000';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

const colorize = (color, text) => `${colors[color]}${text}${colors.reset}`;

// HTTP helper
const makeRequest = (method, path, data = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve({ status: res.statusCode, data: result });
        } catch (error) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
};

// CLI Commands
const commands = {
  async run(agentSlug) {
    if (!agentSlug) {
      console.log(colorize('red', 'Error: Agent slug required'));
      console.log('Usage: node cli.js run <agent-slug>');
      return;
    }

    console.log(colorize('cyan', `Starting agent: ${agentSlug}`));
    
    try {
      const response = await makeRequest('POST', `/api/agents/${agentSlug}/run`);
      
      if (response.status === 200) {
        const { run_id, status } = response.data;
        console.log(colorize('green', `✅ Run started successfully!`));
        console.log(colorize('white', `Run ID: ${run_id}`));
        console.log(colorize('white', `Status: ${status}`));
        console.log(colorize('cyan', `\nTo view logs: node cli.js logs ${run_id}`));
      } else if (response.status === 404) {
        console.log(colorize('red', `❌ Agent not found: ${agentSlug}`));
        console.log(colorize('cyan', 'Available agents:'));
        await commands.list();
      } else {
        console.log(colorize('red', `❌ Error: ${response.data.error || 'Unknown error'}`));
      }
    } catch (error) {
      console.log(colorize('red', `❌ Connection error: ${error.message}`));
    }
  },

  async ps() {
    console.log(colorize('cyan', 'Active Runs:'));
    
    try {
      const response = await makeRequest('GET', '/api/runs');
      
      if (response.status === 200) {
        const runs = response.data;
        if (runs.length === 0) {
          console.log(colorize('yellow', 'No runs found'));
          return;
        }

        console.log(colorize('white', 'ID'.padEnd(36) + 'Agent'.padEnd(20) + 'Status'.padEnd(12) + 'Age'));
        console.log('-'.repeat(80));

        runs.forEach(run => {
          const age = new Date(run.created_at).toLocaleTimeString();
          const statusColor = run.status === 'running' ? 'green' : 
                            run.status === 'complete' ? 'blue' : 
                            run.status === 'failed' ? 'red' : 'yellow';
          
          console.log(
            run.id.substring(0, 8) + '...'.padEnd(36) +
            run.agent_id.substring(0, 8) + '...'.padEnd(20) +
            colorize(statusColor, run.status.padEnd(12)) +
            age
          );
        });
      } else {
        console.log(colorize('red', `❌ Error: ${response.data.error || 'Unknown error'}`));
      }
    } catch (error) {
      console.log(colorize('red', `❌ Connection error: ${error.message}`));
    }
  },

  async logs(runId) {
    if (!runId) {
      console.log(colorize('red', 'Error: Run ID required'));
      console.log('Usage: node cli.js logs <run-id>');
      return;
    }

    console.log(colorize('cyan', `Streaming logs for run: ${runId}`));
    console.log(colorize('yellow', 'Press Ctrl+C to stop\n'));

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/runs/${runId}/logs/stream`,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      if (res.statusCode !== 200) {
        console.log(colorize('red', `❌ Error: ${res.statusCode}`));
        return;
      }

      res.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        
        lines.forEach(line => {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              
              switch (data.type) {
                case 'log':
                  const levelColor = data.level === 'error' ? 'red' : 
                                   data.level === 'warn' ? 'yellow' : 
                                   data.level === 'info' ? 'green' : 'white';
                  console.log(colorize(levelColor, `[${data.level.toUpperCase()}] ${data.message}`));
                  break;
                  
                case 'guard':
                  const severityColor = data.severity === 'error' ? 'red' : 
                                      data.severity === 'warn' ? 'yellow' : 'cyan';
                  console.log(colorize(severityColor, `🛡️  [${data.event_type}] ${data.message}`));
                  break;
                  
                case 'status':
                  console.log(colorize('blue', `📊 Status: ${data.status}`));
                  break;
                  
                case 'done':
                  console.log(colorize('green', `✅ Run completed: ${data.status}`));
                  if (data.duration_ms) {
                    console.log(colorize('white', `⏱️  Duration: ${data.duration_ms}ms`));
                  }
                  process.exit(0);
                  break;
              }
            } catch (error) {
              // Ignore parsing errors for incomplete chunks
            }
          }
        });
      });
    });

    req.on('error', (error) => {
      console.log(colorize('red', `❌ Connection error: ${error.message}`));
    });

    req.end();

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      console.log(colorize('yellow', '\n🛑 Stopping log stream...'));
      req.destroy();
      process.exit(0);
    });
  },

  async stop(runId) {
    if (!runId) {
      console.log(colorize('red', 'Error: Run ID required'));
      console.log('Usage: node cli.js stop <run-id>');
      return;
    }

    console.log(colorize('yellow', `Stopping run: ${runId}`));
    
    try {
      const response = await makeRequest('POST', `/api/runs/${runId}/stop`);
      
      if (response.status === 200) {
        console.log(colorize('green', `✅ Run stopped successfully`));
      } else if (response.status === 404) {
        console.log(colorize('red', `❌ Run not found: ${runId}`));
      } else {
        console.log(colorize('red', `❌ Error: ${response.data.error || 'Unknown error'}`));
      }
    } catch (error) {
      console.log(colorize('red', `❌ Connection error: ${error.message}`));
    }
  },

  async list() {
    console.log(colorize('cyan', 'Available Agents:'));
    
    try {
      const response = await makeRequest('GET', '/api/agents');
      
      if (response.status === 200) {
        const agents = response.data;
        if (agents.length === 0) {
          console.log(colorize('yellow', 'No agents found'));
          return;
        }

        console.log(colorize('white', 'Slug'.padEnd(20) + 'Name'.padEnd(20) + 'Language'.padEnd(12) + 'Visibility'));
        console.log('-'.repeat(70));

        agents.forEach(agent => {
          const config = agent.config_json;
          const visibilityColor = agent.visibility === 'public' ? 'green' : 'yellow';
          
          console.log(
            agent.slug.padEnd(20) +
            agent.name.padEnd(20) +
            config.language.padEnd(12) +
            colorize(visibilityColor, agent.visibility)
          );
        });
      } else {
        console.log(colorize('red', `❌ Error: ${response.data.error || 'Unknown error'}`));
      }
    } catch (error) {
      console.log(colorize('red', `❌ Connection error: ${error.message}`));
    }
  },

  async status() {
    console.log(colorize('cyan', '4Runr Gateway Status:'));
    
    try {
      const healthResponse = await makeRequest('GET', '/health');
      const readyResponse = await makeRequest('GET', '/ready');
      
      console.log(colorize('white', 'Health Check:'), 
        healthResponse.status === 200 ? colorize('green', '✅ OK') : colorize('red', '❌ Failed'));
      
      console.log(colorize('white', 'Readiness Check:'), 
        readyResponse.status === 200 ? colorize('green', '✅ OK') : colorize('red', '❌ Failed'));
      
      if (healthResponse.status === 200 && readyResponse.status === 200) {
        console.log(colorize('green', '\n🎉 Gateway is ready for agent execution!'));
      } else {
        console.log(colorize('red', '\n⚠️  Gateway is not ready'));
      }
    } catch (error) {
      console.log(colorize('red', `❌ Connection error: ${error.message}`));
      console.log(colorize('yellow', 'Make sure the gateway is running: node simple-gateway.js'));
    }
  },

  help() {
    console.log(colorize('cyan', '4Runr CLI - Agent Execution Tool\n'));
    console.log(colorize('white', 'Commands:'));
    console.log(colorize('green', '  run <agent-slug>'), '    Start an agent run');
    console.log(colorize('green', '  ps'), '                  List active runs');
    console.log(colorize('green', '  logs <run-id>'), '       Stream logs for a run');
    console.log(colorize('green', '  stop <run-id>'), '       Stop a running agent');
    console.log(colorize('green', '  list'), '                List available agents');
    console.log(colorize('green', '  status'), '              Check gateway status');
    console.log(colorize('green', '  help'), '                Show this help\n');
    
         console.log(colorize('white', 'Examples:'));
     console.log('  node cli.js run demo-enricher');
     console.log('  node cli.js logs 2dd25001-1c7f-4909-bf70-9ab8749bb2f8');
     console.log('  node cli.js ps');
     console.log('');
     console.log(colorize('yellow', 'Note: Use actual run ID from "ps" command (not <run-id>)'));
  }
};

// Main CLI logic
const main = () => {
  const args = process.argv.slice(2);
  const command = args[0];
  const params = args.slice(1);

  if (!command || command === 'help') {
    commands.help();
    return;
  }

  if (commands[command]) {
    commands[command](...params);
  } else {
    console.log(colorize('red', `Unknown command: ${command}`));
    console.log(colorize('cyan', 'Run "node cli.js help" for available commands'));
  }
};

// Run CLI
if (require.main === module) {
  main();
}

module.exports = { commands, makeRequest };
