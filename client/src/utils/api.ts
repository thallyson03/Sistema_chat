import axios from 'axios';
import { getPublicApiOrigin } from '../config/publicUrl';

// Mesmo domínio (Coolify): baseURL vazio → URLs relativas /api/...
// API em outro host: defina VITE_API_BASE_URL no build
const api = axios.create({
  baseURL: getPublicApiOrigin(),
});

// Interceptor para adicionar token em todas as requisições
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratar erros de autenticação
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Só redirecionar se for 401 (não autorizado - token inválido)
    // 403 pode ser falta de permissão, deixar o componente tratar
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

