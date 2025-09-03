const http = require('http')

const GATEWAY = 'http://localhost:3000'

// Function to get metrics
async function getMetrics() {
  return new Promise((resolve, reject) => {
    const req = http.request(`${GATEWAY}/metrics`, (res) => {
      let body = ''
      res.on('data', (chunk) => {
        body += chunk
      })
      res.on('end', () => {
        resolve(body)
      })
    })
    
    req.on('error', (error) => {
      reject(error)
    })
    
    req.end()
  })
}

// Function to parse metrics
function parseMetrics(metricsText) {
  const lines = metricsText.split('\n')
  const summary = {
    'Agent Creations': 0,
    'Token Generations': 0,
    'Token Validations': 0,
    'Policy Denials': 0,
    'Token Expirations': 0,
    'Chaos Injections': 0,
    'Chaos Clearings': 0
  }
  
  for (const line of lines) {
    if (line.includes('gateway_agent_creations_total_total')) {
      const match = line.match(/\}\s+(\d+)$/)
      if (match) summary['Agent Creations'] += parseInt(match[1])
    }
    if (line.includes('gateway_token_generations_total_total')) {
      const match = line.match(/\}\s+(\d+)$/)
      if (match) summary['Token Generations'] += parseInt(match[1])
    }
    if (line.includes('gateway_token_validations_total_total')) {
      const match = line.match(/\}\s+(\d+)$/)
      if (match) summary['Token Validations'] += parseInt(match[1])
    }
    if (line.includes('gateway_policy_denials_total_total')) {
      const match = line.match(/\}\s+(\d+)$/)
      if (match) summary['Policy Denials'] += parseInt(match[1])
    }
    if (line.includes('gateway_token_expirations_total_total')) {
      const match = line.match(/\}\s+(\d+)$/)
      if (match) summary['Token Expirations'] += parseInt(match[1])
    }
    if (line.includes('gateway_chaos_injections_total_total')) {
      const match = line.match(/\}\s+(\d+)$/)
      if (match) summary['Chaos Injections'] += parseInt(match[1])
    }
    if (line.includes('gateway_chaos_clearings_total_total')) {
      const match = line.match(/\}\s+(\d+)$/)
      if (match) summary['Chaos Clearings'] += parseInt(match[1])
    }
  }
  
  return summary
}

// Function to export simple metrics
async function exportSimpleMetrics() {
  try {
    console.log('📊 Getting 4Runr Gateway metrics...')
    
    const metrics = await getMetrics()
    const summary = parseMetrics(metrics)
    
    console.log('')
    console.log('📋 4RUNR GATEWAY METRICS - COPY-PASTE FORMAT')
    console.log('=============================================')
    console.log('')
    console.log(`Timestamp: ${new Date().toISOString()}`)
    console.log(`Gateway URL: ${GATEWAY}`)
    console.log('')
    console.log('METRICS SUMMARY:')
    console.log('----------------')
    for (const [metric, value] of Object.entries(summary)) {
      console.log(`${metric}: ${value}`)
    }
    console.log('')
    console.log('FULL PROMETHEUS METRICS:')
    console.log('------------------------')
    console.log(metrics)
    console.log('')
    console.log('💡 Copy everything above to share with another AI agent for analysis!')
    
  } catch (error) {
    console.error('❌ Error getting metrics:', error.message)
  }
}

// Run the export
exportSimpleMetrics()
