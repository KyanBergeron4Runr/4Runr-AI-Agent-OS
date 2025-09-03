# Create Policy for Shield Testing
Write-Host "Creating Policy for Shield Testing" -ForegroundColor Green

# First, let's create an agent
$agentBody = @{
    name = "shield-test-agent"
    created_by = "shield-test"
    role = "shield-test-role"
} | ConvertTo-Json

Write-Host "Creating agent..." -ForegroundColor Yellow
$agentResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/create-agent" -Method POST -Body $agentBody -ContentType "application/json"
$agentData = $agentResponse.Content | ConvertFrom-Json
$agentId = $agentData.agent_id

Write-Host "Agent created: $agentId" -ForegroundColor Green

# Now let's create a policy that allows http_fetch:get
$policyBody = @{
    agent_id = $agentId
    name = "shield-test-policy"
    description = "Policy for Shield testing - allows http_fetch:get"
    spec = @{
        scopes = @("http_fetch:get")
        intent = "testing"
        guards = @{
            allowedDomains = @("httpbin.org", "example.com")
            maxRequestSize = 10000
        }
    }
} | ConvertTo-Json -Depth 5

Write-Host "Policy spec:" -ForegroundColor Cyan
Write-Host $policyBody -ForegroundColor Gray

# Since there's no API endpoint to create policies, we need to add it directly to the memory database
# Let's create a simple Node.js script to add the policy
$nodeScript = @"
const { memoryDB } = require('./dist/models/memory-db');

async function addPolicy() {
    try {
        const policy = {
            id: 'shield-test-policy',
            agent_id: '$agentId',
            name: 'shield-test-policy',
            description: 'Policy for Shield testing - allows http_fetch:get',
            spec: JSON.stringify({
                scopes: ['http_fetch:get'],
                intent: 'testing',
                guards: {
                    allowedDomains: ['httpbin.org', 'example.com'],
                    maxRequestSize: 10000
                }
            }),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        await memoryDB.createPolicy(policy);
        console.log('Policy created successfully');
        
        // Verify the policy was created
        const policies = await memoryDB.findPoliciesByAgentId('$agentId');
        console.log('Policies for agent:', policies.length);
        policies.forEach(p => console.log('-', p.name, ':', p.spec));
        
    } catch (error) {
        console.error('Error creating policy:', error);
    }
}

addPolicy();
"@

$nodeScript | Out-File -FilePath "add-policy.js" -Encoding UTF8

Write-Host "Running Node.js script to add policy..." -ForegroundColor Yellow
node add-policy.js

Write-Host "Policy creation completed!" -ForegroundColor Green
Write-Host "Agent ID: $agentId" -ForegroundColor Cyan
Write-Host "You can now use this agent ID in your Shield tests" -ForegroundColor Cyan
