import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = 'https://meetings-ro-api.onrender.com';

// Custom metrics
const healthLatency = new Trend('health_latency');
const docsAvail = new Rate('docs_available');

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.05'],
    docs_available: ['rate>0.9'],
  },
};

export default function () {
  // Test 1: Health check
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
    'health returns ok': (r) => {
      try { return JSON.parse(r.body).status === 'ok'; } catch(e) { return false; }
    },
  });
  healthLatency.add(healthRes.timings.duration);

  // Test 2: API docs
  const docsRes = http.get(`${BASE_URL}/docs`);
  check(docsRes, {
    'docs status is 200': (r) => r.status === 200,
  });
  docsAvail.add(docsRes.status === 200);

  // Test 3: OpenAPI schema
  const openapiRes = http.get(`${BASE_URL}/openapi.json`);
  check(openapiRes, {
    'openapi status is 200': (r) => r.status === 200,
    'openapi has paths': (r) => {
      try { return Object.keys(JSON.parse(r.body).paths).length > 10; } catch(e) { return false; }
    },
  });

  // Test 4: Public verticals endpoint
  const verticalsRes = http.get(`${BASE_URL}/api/v1/verticals`);
  check(verticalsRes, {
    'verticals status is 200': (r) => r.status === 200,
  });

  sleep(Math.random() * 2 + 1);
}
