# Debug Policy Creation
Write-Host "DEBUGGING POLICY CREATION" -ForegroundColor Green

# Check if the policy was created
$debugScript = @"
const { memoryDB } = require('./dist/models/memory-db');

async function debugPolicy() {
    try {
        console.log('=== DEBUGGING POLICY CREATION ===');
        
        // Check all policies
        const allPolicies = await memoryDB.getAllPolicies();
        console.log('Total policies in database:', allPolicies.length);
        
        allPolicies.forEach((p, i) => {
            console.log(\`Policy \${i + 1}:\`);
            console.log('  ID:', p.id);
            console.log('  Agent ID:', p.agent_id);
            console.log('  Name:', p.name);
            console.log('  Spec:', p.spec);
            console.log('');
        });
        
        // Check specific agent
        const agentId = 'edec6fe1-87eb-4143-b15f-9b33d8cd5f8b';
        const policies = await memoryDB.findPoliciesByAgentId(agentId);
        console.log('Policies for agent', agentId + ':', policies.length);
        
        // Check if agent exists
        const agent = await memoryDB.findAgentById(agentId);
        console.log('Agent exists:', !!agent);
        if (agent) {
            console.log('Agent name:', agent.name);
            console.log('Agent role:', agent.role);
        }
        
    } catch (error) {
        console.error('Error debugging policy:', error);
    }
}

debugPolicy();
"@

$debugScript | Out-File -FilePath "debug-policy.js" -Encoding UTF8

Write-Host "Running debug script..." -ForegroundColor Yellow
node debug-policy.js
