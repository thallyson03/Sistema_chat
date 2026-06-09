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
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !String(originalRequest.url || '').includes('/api/auth/login') &&
      !String(originalRequest.url || '').includes('/api/auth/refresh')
    ) {
      originalRequest._retry = true;
      const refreshed = await refreshSession();
      if (refreshed) {
        return api(originalRequest);
      }
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;
