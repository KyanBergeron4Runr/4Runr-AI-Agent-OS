// filepath: 4Runr-Gateway-Spike-Test/src/tests/spike-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 100 }, // ramp up to 100 users
    { duration: '1m', target: 100 }, // stay at 100 users
    { duration: '30s', target: 0 }, // ramp down to 0 users
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'], // fail rate should be less than 1%
    http_req_duration: ['p(95)<200'], // 95% of requests should be below 200ms
  },
};

const routes = [
  '/create-agent',
  '/agents',
  '/agents/{id}',
];

export default function () {
  const route = routes[Math.floor(Math.random() * routes.length)];
  const res = http.get(`http://localhost:3000${route}`);

  check(res, {
    'is status 200': (r) => r.status === 200,
  });

  sleep(1);
}