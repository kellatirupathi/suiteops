import axios from 'axios';

// In dev, Vite proxies "/api" -> localhost:5000.
// In production set VITE_API_URL to the deployed backend, e.g.
//   https://suitesops-api.onrender.com/api
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

// attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('suitesops_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// global 401 handling
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('suitesops_token');
      localStorage.removeItem('suitesops_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;

export function apiError(err) {
  return err?.response?.data?.message || err.message || 'Something went wrong';
}
