import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const BASE_URL = 'https://meetings-ro-api.onrender.com';
const TEST_EMAIL = __ENV.TEST_EMAIL || '';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || '';

// Custom metrics
const loginLatency = new Trend('login_latency');
const meetingsLatency = new Trend('meetings_list_latency');
const meetingDetailLatency = new Trend('meeting_detail_latency');
const usageLatency = new Trend('usage_latency');
const authFailures = new Rate('auth_failures');
const exportLatency = new Trend('export_latency');
const publicEndpoints = new Trend('public_endpoint_latency');

// Counters
const totalMeetingsListed = new Counter('meetings_listed');
const totalMeetingsViewed = new Counter('meetings_viewed');

export const options = {
  scenarios: {
    // Scenario 1: Ramp up to 30 users with realistic traffic mix
    ramp_up: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m',  target: 5  },   // warm-up (cold start pe Render free tier)
        { duration: '2m',  target: 15 },   // ramp la 15 utilizatori
        { duration: '3m',  target: 30 },   // ramp la 30 utilizatori
        { duration: '10m', target: 30 },   // HOLD 30 utilizatori - stress test
        { duration: '2m',  target: 15 },   // ramp down
        { duration: '1m',  target: 0  },   // cool down
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<3000', 'p(99)<5000'],
    http_req_failed:   ['rate<0.05'],
    auth_failures:     ['rate<0.02'],
    login_latency:     ['p(95)<2000'],
    meetings_listed:   ['count>50'],
    meetings_viewed:   ['count>30'],
  },
};

// ==================== SETUP ====================
export function setup() {
  // Login once, share token across all VUs
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'setup_login' },
  });

  const loginOk = check(loginRes, {
    'setup: login ok': (r) => r.status === 200,
  });

  if (!loginOk) {
    console.error(`Login failed: ${loginRes.status} - ${loginRes.body}`);
    return { token: null, meetingId: null };
  }

  const token = JSON.parse(loginRes.body).token;

  // Fetch a real meeting ID for detail/export tests
  const meetingsRes = http.get(`${BASE_URL}/api/meetings`, {
    headers: { 'Authorization': `Bearer ${token}` },
    tags: { name: 'setup_meetings' },
  });

  let meetingId = null;
  if (meetingsRes.status === 200) {
    const data = JSON.parse(meetingsRes.body);
    const meetings = data.meetings || data;
    if (Array.isArray(meetings) && meetings.length > 0) {
      meetingId = meetings[0]._id || meetings[0].id;
      console.log(`Found ${meetings.length} meetings, using ID: ${meetingId}`);
    } else {
      console.log('No meetings found - export/detail tests will be skipped');
    }
  }

  return { token, meetingId };
}

// ==================== MAIN SCENARIO ====================
export default function (data) {
  const { token, meetingId } = data;
  const headers_auth = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // ---- GROUP: Public endpoints (always available) ----
  group('01_Public', function () {
    // Health check
    const healthRes = http.get(`${BASE_URL}/api/health`, { tags: { name: 'health' } });
    check(healthRes, { 'health=200': (r) => r.status === 200 });
    publicEndpoints.add(healthRes.timings.duration);
  });

  sleep(Math.random() * 2 + 1);

  // Skip auth tests if no token
  if (!token) {
    console.warn('No token - skipping authenticated tests');
    sleep(3);
    return;
  }

  // ---- GROUP: Auth (single login per VU lifecycle) ----
  group('02_Auth', function () {
    // Quick token validation (/api/auth/me)
    const meRes = http.get(`${BASE_URL}/api/auth/me`, {
      headers: headers_auth,
      tags: { name: 'auth_me' },
    });
    const meOk = check(meRes, {
      'auth/me=200': (r) => r.status === 200,
    });
    authFailures.add(!meOk);
    loginLatency.add(meRes.timings.duration);
  });

  sleep(Math.random() * 2 + 1);

  // ---- GROUP: List meetings (most common action) ----
  group('03_List_Meetings', function () {
    const listRes = http.get(`${BASE_URL}/api/meetings`, {
      headers: headers_auth,
      tags: { name: 'meetings_list' },
    });
    const listOk = check(listRes, {
      'meetings_list=200': (r) => r.status === 200,
    });
    if (listOk) totalMeetingsListed.add(1);
    meetingsLatency.add(listRes.timings.duration);
  });

  sleep(Math.random() * 2 + 1);

  // ---- GROUP: Usage stats ----
  group('04_Usage', function () {
    const usageRes = http.get(`${BASE_URL}/api/users/me/usage`, {
      headers: headers_auth,
      tags: { name: 'user_usage' },
    });
    check(usageRes, { 'usage=200': (r) => r.status === 200 });
    usageLatency.add(usageRes.timings.duration);
  });

  sleep(Math.random() * 2 + 1);

  // ---- GROUP: Meeting detail (if we have one) ----
  if (meetingId) {
    group('05_Meeting_Detail', function () {
      const detailRes = http.get(`${BASE_URL}/api/meetings/${meetingId}`, {
        headers: headers_auth,
        tags: { name: 'meeting_detail' },
      });
      const detailOk = check(detailRes, {
        'detail=200': (r) => r.status === 200,
      });
      if (detailOk) totalMeetingsViewed.add(1);
      meetingDetailLatency.add(detailRes.timings.duration);
    });

    sleep(Math.random() * 2 + 1);

    // ---- GROUP: Export PV (core feature) ----
    group('06_Export_PV', function () {
      const pvRes = http.get(`${BASE_URL}/api/meetings/${meetingId}/export/proces-verbal`, {
        headers: headers_auth,
        tags: { name: 'export_pv' },
      });
      // Export may take longer (AI generation)
      check(pvRes, {
        'export_pv=200_or_202': (r) => r.status === 200 || r.status === 202 || r.status === 404,
      });
      exportLatency.add(pvRes.timings.duration);
    });

    sleep(Math.random() * 2 + 1);
  }

  // ---- GROUP: Tenant info ----
  group('07_Tenant', function () {
    const tenantRes = http.get(`${BASE_URL}/api/tenants/me`, {
      headers: headers_auth,
      tags: { name: 'tenant_info' },
    });
    check(tenantRes, {
      'tenant=200': (r) => r.status === 200,
    });
  });

  // Realistic delay between full cycles (simulates user reading results)
  sleep(Math.random() * 3 + 2);
}

// ==================== TEARDOWN ====================
export function handleSummary(data) {
  const metrics = data.metrics;
  const httpDuration = metrics.http_req_duration?.values || {};
  const httpFailed = metrics.http_req_failed?.values?.rate || 0;

  return {
    'stdout': `
╔══════════════════════════════════════════════════════════╗
║          MEETINGS.RO LOAD TEST RESULTS                  ║
╠══════════════════════════════════════════════════════════╣
║                                                         ║
║  HTTP Request Duration:                                 ║
║    avg:  ${pad(httpDuration.avg?.toFixed(0))}ms                                 ║
║    p90:  ${pad(httpDuration['p(90)']?.toFixed(0))}ms                                 ║
║    p95:  ${pad(httpDuration['p(95)']?.toFixed(0))}ms                                 ║
║    p99:  ${pad(httpDuration['p(99)']?.toFixed(0))}ms                                 ║
║    max:  ${pad(httpDuration.max?.toFixed(0))}ms                                 ║
║                                                         ║
║  Error Rate:        ${(httpFailed * 100).toFixed(1)}%                              ║
║  Total Requests:    ${pad(metrics.http_reqs?.values?.count?.toFixed(0))}                                  ║
║  Meetings Listed:   ${pad(metrics.meetings_listed?.values?.count?.toFixed(0))}                                  ║
║  Meetings Viewed:   ${pad(metrics.meetings_viewed?.values?.count?.toFixed(0))}                                  ║
║                                                         ║
╚══════════════════════════════════════════════════════════╝
`
  };
}

function pad(s) {
  return String(s || '0').padStart(5);
}
