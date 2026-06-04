import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Counter } from 'k6/metrics';

const BASE_URL = 'https://meetings-ro-api.onrender.com';

// Track errors by endpoint
const errorRate = new Rate('error_rate');
const errorsByEndpoint = new Counter('errors_by_endpoint');
const status4xx = new Counter('status_4xx');
const status5xx = new Counter('status_5xx');
const status2xx = new Counter('status_2xx');

export const options = {
  vus: 30,           // 30 simultaneous users
  duration: '60s',    // just 1 minute for diagnosis
};

export default function () {
  const endpoints = [
    { name: 'health', url: '/api/health' },
    { name: 'docs', url: '/docs' },
    { name: 'openapi', url: '/openapi.json' },
    { name: 'verticals', url: '/api/v1/verticals' },
    { name: 'localities', url: '/api/localities' },
  ];

  // Hit each endpoint once per iteration
  endpoints.forEach(ep => {
    const res = http.get(`${BASE_URL}${ep.url}`, {
      tags: { name: ep.name },
    });

    const isOk = res.status >= 200 && res.status < 400;
    errorRate.add(!isOk);

    if (res.status >= 200 && res.status < 300) {
      status2xx.add(1);
    } else if (res.status >= 400 && res.status < 500) {
      status4xx.add(1);
      console.log(`4xx on ${ep.name}: ${res.status} - ${res.body.substring(0, 100)}`);
      errorsByEndpoint.add(1, { endpoint: ep.name });
    } else if (res.status >= 500) {
      status5xx.add(1);
      console.log(`5xx on ${ep.name}: ${res.status} - ${res.body.substring(0, 100)}`);
      errorsByEndpoint.add(1, { endpoint: ep.name });
    }

    check(res, {
      [`${ep.name}_ok`]: (r) => r.status >= 200 && r.status < 400,
    });
  });

  sleep(1);
}

export function handleSummary(data) {
  const metrics = data.metrics;
  return {
    stdout: `

╔════════════════════════════════════════════════╗
║  ERROR DIAGNOSIS (30 VUs, 60s)              ║
╠════════════════════════════════════════════════╣
║                                               ║
║  2xx (success):  ${String(metrics.status_2xx?.values?.count || 0).padStart(6)}                          ║
║  4xx (client):   ${String(metrics.status_4xx?.values?.count || 0).padStart(6)}                          ║
║  5xx (server):   ${String(metrics.status_5xx?.values?.count || 0).padStart(6)}                          ║
║  Error rate:     ${(metrics.error_rate?.values?.rate * 100 || 0).toFixed(1)}%                          ║
║                                               ║
║  Errors by endpoint (see console.log above)   ║
╚════════════════════════════════════════════════╝
`
  };
}
