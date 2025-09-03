const { memoryDB } = require('./dist/models/memory-db');

async function createPolicy() {
    try {
        const agentId = 'edec6fe1-87eb-4143-b15f-9b33d8cd5f8b';
        
        console.log('Creating policy for agent:', agentId);
        
        const policy = {
            name: 'shield-test-policy',
            description: 'Policy for Shield testing - allows http_fetch:get',
            agentId: agentId, // Note: camelCase, not snake_case
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
        policies.forEach(p => {
            console.log('- Policy:', p.name);
            console.log('  Spec:', p.spec);
        });
        
    } catch (error) {
        console.error('Error creating policy:', error);
    }
}

createPolicy();
