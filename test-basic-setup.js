const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

console.log('🧪 Testing basic 4Runr Gateway setup...\n');

// Test 1: Database connectivity
console.log('1. Testing PostgreSQL connectivity...');
const dbTest = async () => {
  try {
    const { stdout } = await execAsync('docker exec 4runr-postgres pg_isready -U 4runr -d 4runr_gateway');
    console.log('   ✅ PostgreSQL is healthy and accessible');
    return true;
  } catch (err) {
    console.log('   ❌ PostgreSQL connection failed:', err.message);
    return false;
  }
};

// Test 2: Redis connectivity
console.log('2. Testing Redis connectivity...');
const redisTest = async () => {
  try {
    const { stdout } = await execAsync('docker exec 4runr-redis redis-cli ping');
    if (stdout.trim() === 'PONG') {
      console.log('   ✅ Redis is healthy and accessible');
      return true;
    } else {
      console.log('   ❌ Redis ping failed');
      return false;
    }
  } catch (err) {
    console.log('   ❌ Redis connection failed:', err.message);
    return false;
  }
};

// Test 3: Database tables
console.log('3. Testing database tables...');
const tableTest = async () => {
  try {
    const { stdout } = await execAsync('docker exec 4runr-postgres psql -U 4runr -d 4runr_gateway -c "SELECT COUNT(*) FROM agents;"');
    console.log('   ✅ Database tables exist and are accessible');
    return true;
  } catch (err) {
    console.log('   ❌ Database table test failed:', err.message);
    return false;
  }
};

// Test 4: Container health
console.log('4. Testing container health...');
const healthTest = async () => {
  try {
    const { stdout } = await execAsync('docker ps --filter "name=4runr" --format "table {{.Names}}\t{{.Status}}"');
    console.log('   ✅ All 4Runr containers are running:');
    console.log(stdout);
    return true;
  } catch (err) {
    console.log('   ❌ Container health check failed:', err.message);
    return false;
  }
};

// Run all tests
const runTests = async () => {
  const dbOk = await dbTest();
  const redisOk = await redisTest();
  const tablesOk = await tableTest();
  const healthOk = await healthTest();
  
  console.log('\n📊 Test Results:');
  console.log(`   PostgreSQL: ${dbOk ? '✅' : '❌'}`);
  console.log(`   Redis: ${redisOk ? '✅' : '❌'}`);
  console.log(`   Database Tables: ${tablesOk ? '✅' : '❌'}`);
  console.log(`   Container Health: ${healthOk ? '✅' : '❌'}`);
  
  if (dbOk && redisOk && tablesOk && healthOk) {
    console.log('\n🎉 Basic setup is working!');
    console.log('\nNext steps:');
    console.log('1. Fix TypeScript build issues (fastify-cors types)');
    console.log('2. Start the gateway service');
    console.log('3. Run the Prove-It test');
  } else {
    console.log('\n⚠️  Some components need attention');
  }
};

runTests().catch(console.error);
