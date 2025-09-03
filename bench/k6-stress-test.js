import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    // Warm up
    { duration: "2m", target: 20 },
    
    // Ramp up aggressively 
    { duration: "3m", target: 100 },
    { duration: "2m", target: 200 },
    { duration: "2m", target: 500 },
    
    // Stress phase - push to breaking point
    { duration: "3m", target: 1000 },
    { duration: "5m", target: 1500 }, // Really stress it
    
    // Cool down to see recovery
    { duration: "2m", target: 500 },
    { duration: "2m", target: 100 },
    { duration: "1m", target: 0 },
  ],
  
  thresholds: {
    http_req_duration: ['p(95)<5000'], // 95% under 5s (will likely fail)
    http_req_failed: ['rate<0.1'],     // Less than 10% failures initially
  },
};

const BASE = __ENV.GATEWAY_URL || "http://localhost:3000";

export default function () {
  const responses = http.batch([
    ['GET', `${BASE}/health`],
    ['GET', `${BASE}/health`], // Double up to increase load
  ]);
  
  check(responses[0], { 
    "health status 200": (r) => r.status === 200,
    "health response time OK": (r) => r.timings.duration < 1000,
  });
  
  check(responses[1], { 
    "health batch status 200": (r) => r.status === 200,
  });
  
  // Reduce sleep time to increase pressure
  sleep(Math.random() * 0.5 + 0.1); // 0.1-0.6 seconds
}
