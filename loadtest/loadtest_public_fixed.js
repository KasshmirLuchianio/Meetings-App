import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const BASE_URL = 'https://meetings-ro-api.onrender.com';

const healthLatency = new Trend('health_latency');
const docsLatency = new Trend('docs_latency');
const verticalsLatency = new Trend('verticals_latency');
const openapiLatency = new Trend('openapi_latency');

export const options = {
  scenarios: {
    public_load: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m',  target: 5  },   // warm-up
        { duration: '2m',  target: 15 },   // ramp to 15
        { duration: '3m',  target: 30 },   // ramp to 30
        { duration: '10m', target: 30 },   // HOLD at 30 - stress test
        { duration: '2m',  target: 15 },   // ramp down
        { duration: '1m',  target: 0  },   // cool down
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<3000', 'p(99)<5000'],
    http_req_failed:   ['rate<0.01'],  // <1% error rate
    health_latency:    ['p(95)<1000'],
    docs_latency:      ['p(95)<2000'],
    verticals_latency: ['p(95)<1500'],
  },
};

export default function () {
  const headers = { 'Accept': 'application/json' };

  group('01_Health', function () {
    const res = http.get(`${BASE_URL}/api/health`, { headers, tags: { name: 'health' } });
    check(res, {
      'health_status_200': (r) => r.status === 200,
      'health_returns_ok': (r) => {
        try { return JSON.parse(r.body).status === 'ok'; } catch(e) { return false; }
      },
    });
    healthLatency.add(res.timings.duration);
  });

  sleep(Math.random() * 2 + 1);

  group('02_Docs', function () {
    const res = http.get(`${BASE_URL}/docs`, { headers, tags: { name: 'docs' } });
    check(res, {
      'docs_status_200': (r) => r.status === 200,
    });
    docsLatency.add(res.timings.duration);
  });

  sleep(Math.random() * 2 + 1);

  group('03_OpenAPI', function () {
    const res = http.get(`${BASE_URL}/openapi.json`, { headers, tags: { name: 'openapi' } });
    check(res, {
      'openapi_status_200': (r) => r.status === 200,
      'openapi_has_paths': (r) => {
        try { return Object.keys(JSON.parse(r.body).paths).length > 10; } catch(e) { return false; }
      },
    });
    openapiLatency.add(res.timings.duration);
  });

  sleep(Math.random() * 2 + 1);

  group('04_Verticals', function () {
    const res = http.get(`${BASE_URL}/api/v1/verticals`, { headers, tags: { name: 'verticals' } });
    check(res, {
      'verticals_status_200': (r) => r.status === 200,
    });
    verticalsLatency.add(res.timings.duration);
  });

  sleep(Math.random() * 3 + 2);
}

export function handleSummary(data) {
  const m = data.metrics;
  const d = m.http_req_duration?.values || {};

  return {
    'stdout': `
╔═══════════════════════════════════════════════════════════╗
║        MEETINGS.RO PUBLIC LOAD TEST - CORRECTED          ║
╠═══════════════════════════════════════════════════════════╣
║                                                          ║
║  HTTP Request Duration:                                  ║
║    avg:   ${(d.avg || 0).toFixed(0).padStart(5)}ms                               ║
║    p50:   ${(d['p(50)'] || 0).toFixed(0).padStart(5)}ms                               ║
║    p90:   ${(d['p(90)'] || 0).toFixed(0).padStart(5)}ms                               ║
║    p95:   ${(d['p(95)'] || 0).toFixed(0).padStart(5)}ms                               ║
║    p99:   ${(d['p(99)'] || 0).toFixed(0).padStart(5)}ms                               ║
║    max:   ${(d.max || 0).toFixed(0).padStart(5)}ms                               ║
║                                                          ║
║  Error Rate:     ${(m.http_req_failed?.values?.rate * 100 || 0).toFixed(2)}%                               ║
║  Total Requests: ${(m.http_reqs?.values?.count || 0).toFixed(0).padStart(5)}                               ║
║  Success Rate:   ${((1 - (m.http_req_failed?.values?.rate || 0)) * 100).toFixed(2)}%                               ║
║                                                          ║
║  Per-Group Latency (avg):                                ║
║    Health:     ${(m.health_latency?.values?.avg || 0).toFixed(0).padStart(5)}ms                        ║
║    Docs:       ${(m.docs_latency?.values?.avg || 0).toFixed(0).padStart(5)}ms                        ║
║    OpenAPI:    ${(m.openapi_latency?.values?.avg || 0).toFixed(0).padStart(5)}ms                        ║
║    Verticals:  ${(m.verticals_latency?.values?.avg || 0).toFixed(0).padStart(5)}ms                        ║
║                                                          ║
╚═══════════════════════════════════════════════════════════╝
`
  };
}
