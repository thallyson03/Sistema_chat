import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3007';
const TOKEN = __ENV.TOKEN || '';
const VUS = Number(__ENV.VUS || 50);
const DURATION = __ENV.DURATION || '5m';
const CONVERSATIONS_STATUS = __ENV.CONVERSATIONS_STATUS || 'OPEN';

export const options = {
  scenarios: {
    conversations_list: {
      executor: 'constant-vus',
      vus: VUS,
      duration: DURATION,
      exec: 'conversationsList',
    },
    conversations_stats: {
      executor: 'constant-vus',
      vus: Math.max(5, Math.floor(VUS * 0.2)),
      duration: DURATION,
      exec: 'conversationsStats',
      startTime: '5s',
    },
    healthcheck: {
      executor: 'constant-vus',
      vus: 2,
      duration: DURATION,
      exec: 'health',
      startTime: '2s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    checks: ['rate>0.98'],
  },
};

function authHeaders() {
  if (!TOKEN) {
    return { 'Content-Type': 'application/json' };
  }
  return {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  };
}

export function conversationsList() {
  const params = { headers: authHeaders() };
  const statusParam =
    CONVERSATIONS_STATUS && CONVERSATIONS_STATUS.toUpperCase() !== 'NONE'
      ? `&status=${encodeURIComponent(CONVERSATIONS_STATUS)}`
      : '';
  const res = http.get(`${BASE_URL}/api/conversations?limit=50&offset=0${statusParam}`, params);
  check(res, {
    'GET /api/conversations status ok': (r) => r.status === 200 || r.status === 401,
  });
  sleep(1);
}

export function conversationsStats() {
  const params = { headers: authHeaders() };
  const res = http.get(`${BASE_URL}/api/conversations/stats`, params);
  check(res, {
    'GET /api/conversations/stats status ok': (r) => r.status === 200 || r.status === 401,
  });
  sleep(2);
}

export function health() {
  const res = http.get(`${BASE_URL}/health`);
  check(res, {
    'GET /health status 200': (r) => r.status === 200,
  });
  sleep(2);
}

