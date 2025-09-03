const { memoryDB } = require('./dist/models/memory-db');

async function checkPolicy() {
    try {
        const policies = await memoryDB.findPoliciesByAgentId('edec6fe1-87eb-4143-b15f-9b33d8cd5f8b');
        console.log('Policies for agent ' + 'edec6fe1-87eb-4143-b15f-9b33d8cd5f8b' + ':', policies.length);
        policies.forEach(p => {
            console.log('- Policy:', p.name);
            console.log('  Spec:', p.spec);
        });
        
        if (policies.length > 0) {
            console.log('SUCCESS: Agent has policies');
        } else {
            console.log('ERROR: Agent has no policies');
        }
    } catch (error) {
        console.error('Error checking policies:', error);
    }
}

checkPolicy();
