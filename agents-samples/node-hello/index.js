const scenario = process.env.SCENARIO || 'healthy';
const spikeMs = parseInt(process.env.SPIKE_MS || '10000');

console.log(`[${new Date().toISOString()}] Starting Node.js agent with scenario: ${scenario}`);

async function runScenario() {
  switch (scenario) {
    case 'healthy':
      // Normal healthy behavior - heartbeats for 30 seconds
      for (let i = 0; i < 30; i++) {
        console.log(`[${new Date().toISOString()}] Heartbeat ${i + 1}/30 - Healthy agent running`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      console.log(`[${new Date().toISOString()}] Healthy agent completed successfully`);
      process.exit(0);
      break;

    case 'failing':
      // Run for 40 seconds then exit with error code 1
      for (let i = 0; i < 40; i++) {
        console.log(`[${new Date().toISOString()}] Heartbeat ${i + 1}/40 - Failing agent (will crash soon)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      console.log(`[${new Date().toISOString()}] Failing agent - intentional crash`);
      process.exit(1);
      break;

    case 'resourceHog':
      // Create memory spike for specified duration
      console.log(`[${new Date().toISOString()}] Resource spike agent - allocating memory for ${spikeMs}ms`);
      
      // Allocate memory
      const memoryHog = [];
      for (let i = 0; i < 1000000; i++) {
        memoryHog.push(`data-${i}-${Date.now()}`);
      }
      
      console.log(`[${new Date().toISOString()}] Memory allocated, holding for ${spikeMs}ms`);
      await new Promise(resolve => setTimeout(resolve, spikeMs));
      
      // Free memory
      memoryHog.length = 0;
      console.log(`[${new Date().toISOString()}] Memory freed, resource spike completed`);
      process.exit(0);
      break;

    default:
      console.log(`[${new Date().toISOString()}] Unknown scenario: ${scenario}, running healthy mode`);
      // Fall back to healthy behavior
      for (let i = 0; i < 30; i++) {
        console.log(`[${new Date().toISOString()}] Heartbeat ${i + 1}/30 - Default healthy mode`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      process.exit(0);
  }
}

runScenario().catch(error => {
  console.error(`[${new Date().toISOString()}] Agent error:`, error);
  process.exit(1);
});
