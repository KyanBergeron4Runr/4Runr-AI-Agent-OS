console.log(`[node-fail] Agent starting, will test different failure scenarios...`);

// Random failure scenarios for testing auto-restart
const failureTypes = [
  'exit_error',      // Exit with error code
  'memory_leak',     // Simulate memory leak
  'infinite_loop',   // Simulate infinite loop
  'timeout',         // Simulate timeout
  'normal_exit'      // Normal exit (success)
];

const failureType = failureTypes[Math.floor(Math.random() * failureTypes.length)];
console.log(`[node-fail] Selected failure type: ${failureType}`);

switch (failureType) {
  case 'exit_error':
    console.log(`[node-fail] Exiting with error code 1 in 3 seconds...`);
    setTimeout(() => {
      console.log(`[node-fail] Exiting with error.`);
      process.exit(1);
    }, 3000);
    break;
    
  case 'memory_leak':
    console.log(`[node-fail] Simulating memory leak for 5 seconds...`);
    const leak = [];
    let count = 0;
    const interval = setInterval(() => {
      leak.push(new Array(1000000).fill('leak'));
      count++;
      console.log(`[node-fail] Memory leak iteration ${count}`);
      if (count >= 5) {
        clearInterval(interval);
        console.log(`[node-fail] Memory leak simulation complete, exiting.`);
        process.exit(1);
      }
    }, 1000);
    break;
    
  case 'infinite_loop':
    console.log(`[node-fail] Starting infinite loop for 4 seconds...`);
    const startTime = Date.now();
    while (Date.now() - startTime < 4000) {
      // Busy wait
    }
    console.log(`[node-fail] Infinite loop simulation complete, exiting.`);
    process.exit(1);
    break;
    
  case 'timeout':
    console.log(`[node-fail] Simulating timeout (will be killed by Docker)...`);
    // This will run indefinitely and be killed by Docker timeout
    setInterval(() => {
      console.log(`[node-fail] Still running...`);
    }, 1000);
    break;
    
  case 'normal_exit':
    console.log(`[node-fail] Normal operation for 5 seconds...`);
    setTimeout(() => {
      console.log(`[node-fail] Normal completion.`);
      process.exit(0);
    }, 5000);
    break;
}
