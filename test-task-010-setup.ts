import { GatewayClient } from './lib/gatewayClient'

const BASE_URL = 'http://localhost:3000'

async function setupTask010() {
  console.log('Setting up Task 010 environment...')
  
  try {
    // Create a test agent
    console.log('Creating test agent...')
    const agentResponse = await fetch(`${BASE_URL}/api/create-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'task-010-test-agent',
        description: 'Test agent for Task 010 examples',
        created_by: 'task-010-setup',
        role: 'developer'
      })
    })

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text()
      throw new Error(`Failed to create agent: ${agentResponse.status} - ${errorText}`)
    }

    const agentData = await agentResponse.json() as { agent_id: string; private_key: string }
    console.log(`Created agent: ${agentData.agent_id}`)

    // Create .env files for examples
    const envContent = `# Gateway configuration
GATEWAY_URL=${BASE_URL}
AGENT_ID=${agentData.agent_id}
AGENT_PRIVATE_KEY=${agentData.private_key}

# Optional: Override default settings
# GATEWAY_TIMEOUT_MS=6000
`

    // Write .env files for each example
    const fs = require('fs')
    const path = require('path')

    const examples = ['scraper-js', 'enricher-js']
    for (const example of examples) {
      const envPath = path.join('examples', example, '.env')
      fs.writeFileSync(envPath, envContent)
      console.log(`Created ${envPath}`)
    }

    // For Python example, create a different format
    const pythonEnvContent = `# Gateway configuration
GATEWAY_URL=${BASE_URL}
AGENT_ID=${agentData.agent_id}
AGENT_PRIVATE_KEY=${agentData.private_key}

# Optional: Override default settings
# GATEWAY_TIMEOUT_MS=6000
`
    const pythonEnvPath = path.join('examples', 'engager-py', '.env')
    fs.writeFileSync(pythonEnvPath, pythonEnvContent)
    console.log(`Created ${pythonEnvPath}`)

    console.log('\nTask 010 environment setup complete!')
    console.log('You can now run the examples:')
    console.log('  cd examples/scraper-js && npm start')
    console.log('  cd examples/enricher-js && npm start')
    console.log('  cd examples/engager-py && python main.py')

  } catch (error) {
    console.error('Setup failed:', error)
    process.exit(1)
  }
}

setupTask010()
