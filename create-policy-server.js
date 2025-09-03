const { memoryDB } = require('./dist/models/memory-db');

async function createPolicyInServer() {
    try {
        const agentId = 'a1878158-b950-4c40-bb33-2a73e64b81e8';
        
        console.log('Creating policy for agent:', agentId);
        
        const policy = {
            name: 'shield-working-policy',
            description: 'Policy for Shield testing - allows http_fetch:get',
            agentId: agentId,
            spec: JSON.stringify({
                scopes: ['http_fetch:get'],
                intent: 'testing',
                guards: {
                    allowedDomains: ['httpbin.org', 'example.com'],
                    maxRequestSize: 10000
                }
            }),
            specHash: 'test-hash',
            active: true
        };

        const createdPolicy = await memoryDB.createPolicy(policy);
        console.log('Policy created successfully:', createdPolicy.id);
        
        // Verify the policy was created
        const policies = await memoryDB.findPoliciesByAgentId(agentId);
        console.log('Policies for agent:', policies.length);
        
        return { success: true, policyId: createdPolicy.id, policiesCount: policies.length };
        
    } catch (error) {
        console.error('Error creating policy:', error);
        return { success: false, error: error.message };
    }
}

createPolicyInServer().then(result => {
    console.log('RESULT:', JSON.stringify(result));
});
