import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3007';
const TOKEN = __ENV.TOKEN || '';
const VUS = Number(__ENV.VUS || 40);
const DURATION = __ENV.DURATION || '8m';
const CONVERSATIONS_STATUS = __ENV.CONVERSATIONS_STATUS || 'OPEN';
const LIMIT = Number(__ENV.LIMIT || 30);
const WRITE_ENABLED = String(__ENV.WRITE_ENABLED || 'false').toLowerCase() === 'true';

export const options = {
  scenarios: {
    conversations_list: {
      executor: 'constant-vus',
      vus: VUS,
      duration: DURATION,
      exec: 'conversationsList',
    },
    conversation_messages: {
      executor: 'constant-vus',
      vus: Math.max(5, Math.floor(VUS * 0.5)),
      duration: DURATION,
      exec: 'conversationMessages',
      startTime: '5s',
    },
    conversations_stats: {
      executor: 'constant-vus',
      vus: Math.max(3, Math.floor(VUS * 0.2)),
      duration: DURATION,
      exec: 'conversationsStats',
      startTime: '8s',
    },
    unread_count: {
      executor: 'constant-vus',
      vus: 2,
      duration: DURATION,
      exec: 'unreadCount',
      startTime: '10s',
    },
    mark_read: {
      executor: 'constant-vus',
      vus: Math.max(1, Math.floor(VUS * 0.1)),
      duration: DURATION,
      exec: 'markConversationRead',
      startTime: '12s',
    },
    healthcheck: {
      executor: 'constant-vus',
      vus: 1,
      duration: DURATION,
      exec: 'health',
      startTime: '2s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<900', 'p(99)<1600'],
    checks: ['rate>0.97'],
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

function buildStatusParam() {
  if (!CONVERSATIONS_STATUS || CONVERSATIONS_STATUS.toUpperCase() === 'NONE') {
    return '';
  }
  return `&status=${encodeURIComponent(CONVERSATIONS_STATUS)}`;
}

function fetchConversationIds() {
  const params = { headers: authHeaders() };
  const statusParam = buildStatusParam();
  const res = http.get(
    `${BASE_URL}/api/conversations?limit=${LIMIT}&offset=0${statusParam}`,
    params,
  );

  const ok = check(res, {
    'GET /api/conversations status ok': (r) => r.status === 200 || r.status === 401,
  });

  if (!ok || res.status !== 200) {
    return [];
  }

  let body;
  try {
    body = res.json();
  } catch (e) {
    return [];
  }

  const conversations = Array.isArray(body?.conversations)
    ? body.conversations
    : Array.isArray(body)
      ? body
      : [];

  return conversations.map((c) => c?.id).filter(Boolean);
}

export function conversationsList() {
  fetchConversationIds();
  sleep(1);
}

export function conversationMessages() {
  const ids = fetchConversationIds();
  if (!ids.length) {
    sleep(1);
    return;
  }

  const index = Math.floor(Math.random() * ids.length);
  const conversationId = ids[index];
  const params = { headers: authHeaders() };
  const res = http.get(
    `${BASE_URL}/api/messages/conversation/${encodeURIComponent(conversationId)}?limit=50&offset=0`,
    params,
  );

  check(res, {
    'GET /api/messages/conversation/:id status ok': (r) => r.status === 200 || r.status === 401,
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

export function unreadCount() {
  const params = { headers: authHeaders() };
  const res = http.get(`${BASE_URL}/api/conversations/unread-count`, params);

  check(res, {
    'GET /api/conversations/unread-count status ok': (r) => r.status === 200 || r.status === 401,
  });

  sleep(2);
}

export function markConversationRead() {
  if (!WRITE_ENABLED) {
    sleep(2);
    return;
  }

  const ids = fetchConversationIds();
  if (!ids.length) {
    sleep(2);
    return;
  }

  const index = Math.floor(Math.random() * ids.length);
  const conversationId = ids[index];
  const params = { headers: authHeaders() };
  const res = http.put(
    `${BASE_URL}/api/messages/conversation/${encodeURIComponent(conversationId)}/read`,
    '{}',
    params,
  );

  check(res, {
    'PUT /api/messages/conversation/:id/read status ok': (r) =>
      r.status === 200 || r.status === 204 || r.status === 401,
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
