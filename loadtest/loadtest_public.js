import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const BASE_URL = 'https://meetings-ro-api.onrender.com';

// Custom metrics
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
    http_req_failed:   ['rate<0.05'],
    health_latency:    ['p(95)<1000'],
    docs_latency:      ['p(95)<2000'],
    verticals_latency: ['p(95)<1500'],
  },
};

export default function () {
  const headers = { 'Accept': 'application/json' };

  // GROUP 1: Health check (every iteration)
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

  // GROUP 2: API Docs (simulates user reading docs)
  group('02_Docs', function () {
    const res = http.get(`${BASE_URL}/docs`, { headers, tags: { name: 'docs' } });
    check(res, {
      'docs_status_200': (r) => r.status === 200,
    });
    docsLatency.add(res.timings.duration);
  });

  sleep(Math.random() * 2 + 1);

  // GROUP 3: OpenAPI schema (full JSON parse)
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

  // GROUP 4: Verticals (public data)
  group('04_Verticals', function () {
    const res = http.get(`${BASE_URL}/api/v1/verticals`, { headers, tags: { name: 'verticals' } });
    check(res, {
      'verticals_status_200': (r) => r.status === 200,
    });
    verticalsLatency.add(res.timings.duration);
  });

  sleep(Math.random() * 2 + 1);

  // GROUP 5: Localities (public, larger payload)
  group('05_Localities', function () {
    const res = http.get(`${BASE_URL}/api/localities`, { headers, tags: { name: 'localities' } });
    check(res, {
      'localities_status_200': (r) => r.status === 200,
    });
  });

  sleep(Math.random() * 3 + 2);
}

export function handleSummary(data) {
  const m = data.metrics;
  const d = m.http_req_duration?.values || {};
  const failed = m.http_req_failed?.values?.rate || 0;

  return {
    'stdout': `
╔═══════════════════════════════════════════════════════════╗
║        MEETINGS.RO PUBLIC LOAD TEST RESULTS              ║
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
║  Error Rate:     ${(failed * 100).toFixed(2)}%                                ║
║  Total Requests: ${(m.http_reqs?.values?.count || 0).toFixed(0).padStart(5)}                                ║
║                                                          ║
║  Per-Group Latency (avg):                                ║
║    Health:     ${(m.health_latency?.values?.avg || 0).toFixed(0).padStart(5)}ms                        ║
║    Docs:       ${(m.docs_latency?.values?.avg || 0).toFixed(0).padStart(5)}ms                        ║
║    Verticals:  ${(m.verticals_latency?.values?.avg || 0).toFixed(0).padStart(5)}ms                        ║
║    OpenAPI:    ${(m.openapi_latency?.values?.avg || 0).toFixed(0).padStart(5)}ms                        ║
║                                                          ║
╚═══════════════════════════════════════════════════════════╝
`
  };
}
