import axios from 'axios';
import { getPublicApiOrigin } from '../config/publicUrl';

const api = axios.create({
  baseURL: getPublicApiOrigin(),
  withCredentials: true,
});

function getCsrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(/(?:^|;\s*)csrfToken=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

function isSessionReloginRequired(error: unknown): boolean {
  const data = (error as { response?: { data?: { code?: string } } })?.response?.data;
  return data?.code === 'SESSION_RELOGIN_REQUIRED';
}

async function clearStaleSession(): Promise<void> {
  try {
    await api.post('/api/auth/clear-session');
  } catch {
    // ignora — cookies podem já estar inválidos
  }
}

function redirectToRelogin(): void {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === '/login') return;
  window.location.href = '/login?relogin=1';
}

api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase();
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    const csrf = getCsrfToken();
    if (csrf) {
      config.headers = config.headers || {};
      config.headers['X-CSRF-Token'] = csrf;
    }
  }
  return config;
});

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = api
      .post('/api/auth/refresh')
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (isSessionReloginRequired(error)) {
      await clearStaleSession();
      redirectToRelogin();
      return Promise.reject(error);
    }

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !String(originalRequest.url || '').includes('/api/auth/login') &&
      !String(originalRequest.url || '').includes('/api/auth/refresh') &&
      !String(originalRequest.url || '').includes('/api/auth/clear-session')
    ) {
      originalRequest._retry = true;
      const refreshed = await refreshSession();
      if (refreshed) {
        return api(originalRequest);
      }
      await clearStaleSession();
      redirectToRelogin();
    }

    if (error.response?.status === 403 && isSessionReloginRequired(error)) {
      await clearStaleSession();
      redirectToRelogin();
    }

    return Promise.reject(error);
  },
);

export default api;
