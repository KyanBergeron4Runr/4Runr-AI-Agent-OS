const axios = require('axios');
const { v4: uuid } = require('uuid');

const BASE = process.env.BASE || 'http://localhost:9999';
const key = uuid(); // Generate ONE key for all requests
const body = { name: "race-run", params: { n: 1 } };

console.log(`🚀 Testing idempotency with key: ${key}`);
console.log(`📝 Body: ${JSON.stringify(body)}`);
console.log('');

async function fire(n) {
  return axios.post(`${BASE}/api/runs`, body, {
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    validateStatus: () => true
  }).then(r => ({ n, status: r.status, id: r.data?.id }));
}

(async () => {
  const calls = Array.from({ length: 10 }, (_, i) => fire(i));
  const res = await Promise.all(calls);
  
  console.log('📊 Results:');
  console.table(res);
  
  // Analyze results
  const statusCounts = res.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  
  console.log('\n📈 Status Summary:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count} requests`);
  });
  
  // Check if idempotency worked
  if (statusCounts['201'] === 1 && statusCounts['200'] === 9) {
    console.log('\n✅ SUCCESS: Idempotency working correctly!');
    console.log('   - 1 request created (201)');
    console.log('   - 9 requests returned cached response (200)');
  } else if (statusCounts['201'] > 1) {
    console.log('\n❌ FAILURE: Idempotency not working - multiple creations');
    console.log('   - Expected: 1 creation, 9 cached responses');
    console.log('   - Actual: Multiple creations detected');
  } else {
    console.log('\n⚠️  UNEXPECTED: Mixed results');
  }
})();
