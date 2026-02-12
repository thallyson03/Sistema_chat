import axios from 'axios';

const API_BASE = 'http://localhost:3007';

// Configurar axios com interceptor para adicionar token automaticamente
const api = axios.create({
  baseURL: API_BASE,
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

