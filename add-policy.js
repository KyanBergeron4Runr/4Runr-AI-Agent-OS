const { memoryDB } = require('./dist/models/memory-db');

async function addPolicy() {
    try {
        const policy = {
            id: 'shield-test-policy',
            agent_id: 'edec6fe1-87eb-4143-b15f-9b33d8cd5f8b',
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
        const policies = await memoryDB.findPoliciesByAgentId('edec6fe1-87eb-4143-b15f-9b33d8cd5f8b');
        console.log('Policies for agent:', policies.length);
        policies.forEach(p => console.log('-', p.name, ':', p.spec));
        
    } catch (error) {
        console.error('Error creating policy:', error);
    }
}

addPolicy();
