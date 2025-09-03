import fs from "fs";

const BASE = process.env.GATEWAY_URL || "http://localhost:3000";
const OUT = "reports/stress-health.csv";
const DURATION_MINUTES = 25; // Match the stress test duration
const SAMPLE_INTERVAL = 10; // Every 10 seconds

console.log(`Starting stress health monitor for ${DURATION_MINUTES} minutes...`);
console.log(`Sampling every ${SAMPLE_INTERVAL} seconds`);
console.log(`Target: ${BASE}`);

(async () => {
  fs.mkdirSync("reports", { recursive: true });
  fs.writeFileSync(OUT, "ts,ok,response_time_ms,error\n");

  const totalSamples = (DURATION_MINUTES * 60) / SAMPLE_INTERVAL;
  
  for (let i = 0; i < totalSamples; i++) {
    const ts = new Date().toISOString();
    let ok = 0;
    let responseTime = 0;
    let error = "";
    
    try {
      const start = Date.now();
      const response = await fetch(`${BASE}/health`);
      responseTime = Date.now() - start;
      ok = response.ok ? 1 : 0;
      
      if (!response.ok) {
        error = `HTTP_${response.status}`;
      }
    } catch (e) {
      error = e.message.substring(0, 50); // Truncate long errors
    }
    
    fs.appendFileSync(OUT, `${ts},${ok},${responseTime},"${error}"\n`);
    
    // Log progress every minute
    if (i % 6 === 0) {
      const progress = ((i / totalSamples) * 100).toFixed(1);
      console.log(`[${progress}%] Health check ${i}/${totalSamples} - OK: ${ok}, Time: ${responseTime}ms`);
    }
    
    await new Promise((r) => setTimeout(r, SAMPLE_INTERVAL * 1000));
  }
  
  console.log(`Stress health monitoring complete. Results in ${OUT}`);
})();
