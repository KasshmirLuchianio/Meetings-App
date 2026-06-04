import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = 'https://meetings-ro-api.onrender.com';
const TEST_EMAIL = __ENV.TEST_EMAIL || '';

// Load audio file once - this simulates users "speaking" (uploading audio)
// 3 seconds of WAV audio = 259KB
const audioFile = open('/home/kashmirluchiano/test_audio.wav', 'b');
const audioFileData = http.file(audioFile, 'meeting_audio.wav', 'audio/wav');

// Custom metrics
const createLatency = new Trend('meeting_create_latency');
const uploadLatency = new Trend('audio_upload_latency');
const exportLatency = new Trend('export_pv_latency');

export const options = {
  scenarios: {
    real_users: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m',  target: 5  },   // warm-up: 5 users join
        { duration: '2m',  target: 15 },   // ramp to 15
        { duration: '3m',  target: 30 },   // ramp to 30
        { duration: '10m', target: 30 },   // HOLD 30 - ALL USERS ACTIVE
        { duration: '2m',  target: 15 },   // ramp down
        { duration: '1m',  target: 0  },   // cool down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<10000'],
    http_req_failed:   ['rate<0.15'],
  },
};

// ==================== SETUP ====================
export function setup() {
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: 'kazi.mic8@gmail.com',
    password: 'Minmin1.',
  }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'setup_login' },
  });

  const ok = check(loginRes, { 'setup_login_200': (r) => r.status === 200 });
  if (!ok) {
    console.error(`SETUP FAILED: ${loginRes.status} ${loginRes.body}`);
    return { token: null };
  }

  const token = JSON.parse(loginRes.body).token;
  console.log(`Setup OK - token obtained for ${TEST_EMAIL}`);
  return { token };
}

// ==================== MAIN ====================
export default function (data) {
  const { token } = data;
  if (!token) {
    console.warn('No token - skipping iteration');
    sleep(5);
    return;
  }

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Store meeting ID per-VU for the full iteration
  let meetingId = '';

  // ---- STEP 1: CREATE MEETING ----
  group('01_Create_Meeting', function () {
    const locs = ['Bucuresti', 'Cluj', 'Timisoara', 'Iasi', 'Constanta'];
    const loc = locs[Math.floor(Math.random() * locs.length)];
    const num = Math.floor(Math.random() * 90000) + 10000;

    const res = http.post(`${BASE_URL}/api/meetings`, JSON.stringify({
      title: `Sedinta Consiliul Local ${loc} - ${num}`,
      locality: loc,
      vertical_type: 'GAL',
    }), { headers: authHeaders, tags: { name: 'create_meeting' } });

    const ok = check(res, { 'meeting_created': (r) => r.status === 200 });
    if (ok) {
      const body = JSON.parse(res.body);
      meetingId = body._id || body.id || '';
    }
    createLatency.add(res.timings.duration);
  });

  if (!meetingId) {
    console.warn('No meeting created - skipping upload');
    sleep(5);
    return;
  }

  sleep(Math.random() * 2 + 0.5);

  // ---- STEP 2: UPLOAD AUDIO (USERS SPEAK) ----
  group('02_Upload_Audio', function () {
    const res = http.post(`${BASE_URL}/api/meetings/${meetingId}/upload`, {
      file: audioFileData,
    }, {
      headers: { 'Authorization': `Bearer ${token}` },
      tags: { name: 'upload_audio' },
    });

    const ok = check(res, {
      'upload_200': (r) => r.status === 200,
      'upload_202': (r) => r.status === 202,
    });

    console.log(`VU ${__VU} uploaded audio to ${meetingId}: ${res.status}`);
    uploadLatency.add(res.timings.duration);
  });

  sleep(Math.random() * 5 + 3);  // Wait for AI processing

  // ---- STEP 3: CHECK STATUS ----
  group('03_Check_Status', function () {
    const res = http.get(`${BASE_URL}/api/meetings/${meetingId}`, {
      headers: authHeaders,
      tags: { name: 'meeting_status' },
    });

    check(res, { 'status_200': (r) => r.status === 200 });
  });

  sleep(Math.random() * 2 + 1);

  // ---- STEP 4: EXPORT PV ----
  group('04_Export_PV', function () {
    const res = http.get(`${BASE_URL}/api/meetings/${meetingId}/export/proces-verbal`, {
      headers: authHeaders,
      tags: { name: 'export_pv' },
    });

    check(res, {
      'pv_200': (r) => r.status === 200,
      'pv_202': (r) => r.status === 202,
      'pv_404': (r) => r.status === 404,   // expected if not processed yet
    });
    exportLatency.add(res.timings.duration);
  });

  // Cleanup: delete the meeting to not pollute the DB
  group('05_Cleanup', function () {
    http.del(`${BASE_URL}/api/meetings/${meetingId}`, null, {
      headers: authHeaders,
      tags: { name: 'delete_meeting' },
    });
  });

  sleep(Math.random() * 3 + 2);
}

// ==================== SUMMARY ====================
export function handleSummary(data) {
  const m = data.metrics;
  const d = m.http_req_duration?.values || {};
  const failed = m.http_req_failed?.values?.rate || 0;

  return {
    'stdout': `
╔═══════════════════════════════════════════════════════════╗
║   MEETINGS.RO - REAL USER LOAD TEST                      ║
║   ${Math.round(m.http_reqs?.values?.count || 0)} requests, ${m.vus?.values?.max || 0} max VUs              ║
╠═══════════════════════════════════════════════════════════╣
║                                                          ║
║  HTTP Request Duration:                                  ║
║    avg:  ${(d.avg || 0).toFixed(0).padStart(5)}ms                               ║
║    p90:  ${(d['p(90)'] || 0).toFixed(0).padStart(5)}ms                               ║
║    p95:  ${(d['p(95)'] || 0).toFixed(0).padStart(5)}ms                               ║
║    p99:  ${(d['p(99)'] || 0).toFixed(0).padStart(5)}ms                               ║
║    max:  ${(d.max || 0).toFixed(0).padStart(5)}ms                               ║
║                                                          ║
║  Error Rate:  ${(failed * 100).toFixed(1)}%                                 ║
║                                                          ║
║  REAL FLOW:                                              ║
║    Create Meeting (avg): ${(m.meeting_create_latency?.values?.avg || 0).toFixed(0).padStart(5)}ms           ║
║    Upload Audio  (avg): ${(m.audio_upload_latency?.values?.avg || 0).toFixed(0).padStart(5)}ms           ║
║    Export PV     (avg): ${(m.export_pv_latency?.values?.avg || 0).toFixed(0).padStart(5)}ms           ║
║                                                          ║
╚═══════════════════════════════════════════════════════════╝
`,
  };
}
