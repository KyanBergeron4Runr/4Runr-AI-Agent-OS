const http = require('http');

console.log('🔍 Debugging guard events...');

// Test direct SSE connection
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/runs/57a7dc74-b421-4835-bf59-46dcd6c26d9a/logs/stream',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  res.on('data', (chunk) => {
    const lines = chunk.toString().split('\n');
    
    lines.forEach(line => {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.substring(6));
          console.log(`📨 Event: ${data.type}`, data);
        } catch (error) {
          // Ignore parsing errors
        }
      }
    });
  });
});

req.on('error', (error) => {
  console.log(`❌ Error: ${error.message}`);
});

req.end();
