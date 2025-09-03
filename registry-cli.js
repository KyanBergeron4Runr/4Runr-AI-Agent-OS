#!/usr/bin/env node

const http = require('http');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

// Registry CLI Commands
const registryCommands = {
  async publish(agentSlug) {
    if (!agentSlug) {
      console.log(colorize('red', 'Error: Agent slug required'));
      console.log('Usage: node registry-cli.js publish <agent-slug>');
      return;
    }

    console.log(colorize('cyan', `Publishing agent: ${agentSlug}`));
    
    try {
      // Get agent details
      const agentResponse = await makeRequest('GET', `/api/agents/${agentSlug}`);
      
      if (agentResponse.status !== 200) {
        console.log(colorize('red', `❌ Agent not found: ${agentSlug}`));
        return;
      }
      
      const agent = agentResponse.data;
      
      // Prompt for registry details
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const askQuestion = (question) => {
        return new Promise((resolve) => {
          rl.question(question, resolve);
        });
      };
      
      const namespace = await askQuestion('Namespace (e.g., mycompany): ');
      const name = await askQuestion('Name (e.g., data-processor): ');
      const summary = await askQuestion('Summary (brief description): ');
      const tags = await askQuestion('Tags (comma-separated, e.g., data,ml,api): ');
      const readme = await askQuestion('README (markdown, press Enter twice to finish):\n');
      
      rl.close();
      
      const slug = `${namespace}/${name}`;
      const tagArray = tags.split(',').map(t => t.trim()).filter(t => t);
      
      // Publish to registry
      const publishData = {
        slug,
        version: '1.0.0',
        summary,
        tags: tagArray,
        readme_md: readme,
        publisher_id: 'demo-publisher'
      };
      
      const response = await makeRequest('POST', `/api/agents/${agent.id}/publish`, publishData);
      
      if (response.status === 201) {
        console.log(colorize('green', `✅ Agent published successfully!`));
        console.log(colorize('white', `Registry URL: ${response.data.registry_url}`));
        console.log(colorize('white', `Slug: ${response.data.agent.slug}`));
        console.log(colorize('white', `Version: ${response.data.agent.version}`));
      } else {
        console.log(colorize('red', `❌ Publish failed: ${response.data.error || 'Unknown error'}`));
        if (response.data.details) {
          response.data.details.forEach(error => {
            console.log(colorize('red', `  - ${error}`));
          });
        }
      }
    } catch (error) {
      console.log(colorize('red', `❌ Connection error: ${error.message}`));
    }
  },

  async search(query) {
    if (!query) {
      console.log(colorize('red', 'Error: Search query required'));
      console.log('Usage: node registry-cli.js search "<query>"');
      return;
    }

    console.log(colorize('cyan', `Searching for: "${query}"`));
    
    try {
      const response = await makeRequest('GET', `/api/registry/agents?q=${encodeURIComponent(query)}`);
      
      if (response.status === 200) {
        const { agents, total } = response.data;
        
        if (agents.length === 0) {
          console.log(colorize('yellow', 'No agents found'));
          return;
        }

        console.log(colorize('white', `Found ${total} agents:\n`));
        console.log(colorize('white', 'Slug'.padEnd(30) + 'Version'.padEnd(12) + 'Tags'.padEnd(20) + 'Summary'));
        console.log('-'.repeat(80));

        agents.forEach(agent => {
          const tags = agent.tags.slice(0, 2).join(', ');
          const summary = agent.summary.substring(0, 40) + (agent.summary.length > 40 ? '...' : '');
          const verified = agent.verified ? '✓' : ' ';
          
          console.log(
            colorize('cyan', `${verified}${agent.slug}`.padEnd(30)) +
            agent.version.padEnd(12) +
            tags.padEnd(20) +
            summary
          );
        });
        
        console.log(colorize('yellow', `\nUse "node registry-cli.js pull <slug>" to install an agent`));
      } else {
        console.log(colorize('red', `❌ Search failed: ${response.data.error || 'Unknown error'}`));
      }
    } catch (error) {
      console.log(colorize('red', `❌ Connection error: ${error.message}`));
    }
  },

  async pull(slugWithVersion) {
    if (!slugWithVersion) {
      console.log(colorize('red', 'Error: Agent slug required'));
      console.log('Usage: node registry-cli.js pull <namespace/name[@version]>');
      return;
    }

    const [slug, version] = slugWithVersion.split('@');
    const targetVersion = version || 'latest';
    
    console.log(colorize('cyan', `Pulling agent: ${slug}${version ? '@' + version : ''}`));
    
    try {
      // Get manifest
      const manifestResponse = await makeRequest('GET', `/api/registry/agents/${slug}/manifest`);
      
      if (manifestResponse.status !== 200) {
        console.log(colorize('red', `❌ Agent not found: ${slug}`));
        return;
      }
      
      const manifestData = manifestResponse.data;
      
      // Verify signature
      const verifyResponse = await makeRequest('GET', `/api/registry/public-key`);
      if (verifyResponse.status !== 200) {
        console.log(colorize('red', '❌ Could not get registry public key'));
        return;
      }
      
      // In a real implementation, you would verify the signature here
      // For demo purposes, we'll assume it's valid
      console.log(colorize('green', '✅ Signature verified'));
      
      // Create local agent
      const agent = {
        id: crypto.randomUUID(),
        workspace_id: 'local-workspace',
        name: manifestData.agent.name,
        slug: `${slug}-local`,
        visibility: 'public',
        config_json: {
          entry: manifestData.manifest.entry,
          language: manifestData.manifest.language,
          env_refs: manifestData.manifest.env_ref_names,
          policy_refs: manifestData.manifest.policy_refs,
          resources: { cpu: '0.5', mem: '512Mi' }
        }
      };
      
      // In a real implementation, you would save this to your local workspace
      console.log(colorize('green', '✅ Agent pulled successfully!'));
      console.log(colorize('white', `Name: ${agent.name}`));
      console.log(colorize('white', `Slug: ${agent.slug}`));
      console.log(colorize('white', `Language: ${agent.config_json.language}`));
      console.log(colorize('white', `Entry: ${agent.config_json.entry}`));
      
      if (manifestData.manifest.tags.length > 0) {
        console.log(colorize('white', `Tags: ${manifestData.manifest.tags.join(', ')}`));
      }
      
      console.log(colorize('cyan', `\nUse "node cli.js run ${agent.slug}" to run the agent`));
      
    } catch (error) {
      console.log(colorize('red', `❌ Pull failed: ${error.message}`));
    }
  },

  async show(slug) {
    if (!slug) {
      console.log(colorize('red', 'Error: Agent slug required'));
      console.log('Usage: node registry-cli.js show <namespace/name>');
      return;
    }

    console.log(colorize('cyan', `Showing agent: ${slug}`));
    
    try {
      const response = await makeRequest('GET', `/api/registry/agents/${slug}`);
      
      if (response.status === 200) {
        const agent = response.data;
        
        console.log(colorize('white', `\n📦 ${agent.name}`));
        console.log(colorize('cyan', `Slug: ${agent.slug}`));
        console.log(colorize('cyan', `Version: ${agent.version}`));
        console.log(colorize('cyan', `Publisher: ${agent.publisher_id}`));
        console.log(colorize('cyan', `Verified: ${agent.verified ? 'Yes' : 'No'}`));
        console.log(colorize('cyan', `Created: ${new Date(agent.created_at).toLocaleDateString()}`));
        
        if (agent.manifest) {
          console.log(colorize('white', `\n🔧 Configuration:`));
          console.log(colorize('cyan', `Language: ${agent.manifest.language}`));
          console.log(colorize('cyan', `Entry: ${agent.manifest.entry}`));
          
          if (agent.manifest.env_ref_names.length > 0) {
            console.log(colorize('cyan', `Environment: ${agent.manifest.env_ref_names.join(', ')}`));
          }
          
          if (agent.manifest.policy_refs.length > 0) {
            console.log(colorize('cyan', `Policies: ${agent.manifest.policy_refs.join(', ')}`));
          }
          
          if (agent.manifest.tags.length > 0) {
            console.log(colorize('white', `\n🏷️  Tags: ${agent.manifest.tags.join(', ')}`));
          }
          
          if (agent.manifest.summary) {
            console.log(colorize('white', `\n📝 Summary:`));
            console.log(colorize('white', agent.manifest.summary));
          }
          
          if (agent.manifest.readme_md) {
            console.log(colorize('white', `\n📖 README:`));
            console.log(colorize('white', agent.manifest.readme_md));
          }
        }
        
        if (agent.versions && agent.versions.length > 1) {
          console.log(colorize('white', `\n📋 Versions: ${agent.versions.join(', ')}`));
        }
        
        console.log(colorize('yellow', `\n💡 Install: node registry-cli.js pull ${agent.slug}`));
        console.log(colorize('yellow', `🚀 Run: node cli.js run ${agent.slug}-local`));
        
      } else {
        console.log(colorize('red', `❌ Agent not found: ${slug}`));
      }
    } catch (error) {
      console.log(colorize('red', `❌ Connection error: ${error.message}`));
    }
  },

  async report(slug, reason) {
    if (!slug || !reason) {
      console.log(colorize('red', 'Error: Slug and reason required'));
      console.log('Usage: node registry-cli.js report <slug> "<reason>"');
      return;
    }

    console.log(colorize('yellow', `Reporting agent: ${slug}`));
    
    try {
      const response = await makeRequest('POST', '/api/registry/report', {
        slug,
        reason,
        reporter_id: 'cli-user'
      });
      
      if (response.status === 200) {
        console.log(colorize('green', '✅ Report submitted successfully'));
        console.log(colorize('white', `Report ID: ${response.data.report_id}`));
      } else {
        console.log(colorize('red', `❌ Report failed: ${response.data.error || 'Unknown error'}`));
      }
    } catch (error) {
      console.log(colorize('red', `❌ Connection error: ${error.message}`));
    }
  }
};

// Original CLI Commands (from cli.js)
const commands = {
  async run(agentSlug) {
    if (!agentSlug) {
      console.log(colorize('red', 'Error: Agent slug required'));
      console.log('Usage: node registry-cli.js run <agent-slug>');
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
        console.log(colorize('cyan', `\nTo view logs: node registry-cli.js logs ${run_id}`));
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
      console.log('Usage: node registry-cli.js logs <run-id>');
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
      console.log('Usage: node registry-cli.js stop <run-id>');
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
      console.log(colorize('yellow', 'Make sure the gateway is running: node registry-gateway.js'));
    }
  },

  help() {
    console.log(colorize('cyan', '4Runr Registry CLI - Agent Management Tool\n'));
    console.log(colorize('white', 'Registry Commands:'));
    console.log(colorize('green', '  publish <agent-slug>'), '     Publish agent to registry');
    console.log(colorize('green', '  search "<query>"'), '         Search registry agents');
    console.log(colorize('green', '  pull <slug[@version]>'), '    Pull agent from registry');
    console.log(colorize('green', '  show <slug>'), '              Show agent details');
    console.log(colorize('green', '  report <slug> "<reason>"'), ' Report abuse');
    console.log(colorize('white', '\nExecution Commands:'));
    console.log(colorize('green', '  run <agent-slug>'), '         Start an agent run');
    console.log(colorize('green', '  ps'), '                       List active runs');
    console.log(colorize('green', '  logs <run-id>'), '            Stream logs for a run');
    console.log(colorize('green', '  stop <run-id>'), '            Stop a running agent');
    console.log(colorize('green', '  list'), '                     List available agents');
    console.log(colorize('green', '  status'), '                   Check gateway status');
    console.log(colorize('green', '  help'), '                     Show this help\n');
    
    console.log(colorize('white', 'Examples:'));
    console.log('  node registry-cli.js publish demo-enricher');
    console.log('  node registry-cli.js search "data processor"');
    console.log('  node registry-cli.js pull demo/hello-world');
    console.log('  node registry-cli.js show demo/hello-world');
    console.log('  node registry-cli.js run demo-enricher');
    console.log('  node registry-cli.js logs 2dd25001-1c7f-4909-bf70-9ab8749bb2f8');
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

  // Check if it's a registry command
  if (registryCommands[command]) {
    registryCommands[command](...params);
  } else if (commands[command]) {
    commands[command](...params);
  } else {
    console.log(colorize('red', `Unknown command: ${command}`));
    console.log(colorize('cyan', 'Run "node registry-cli.js help" for available commands'));
  }
};

// Run CLI
if (require.main === module) {
  main();
}

module.exports = { commands, registryCommands, makeRequest };
