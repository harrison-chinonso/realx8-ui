import axios from 'axios';
import useAuthStore from '../store/authStore';
import { API_BASE } from './apiBase';
import { extractError } from '../utils/extractError';

const client = axios.create({
  baseURL: API_BASE,
});

let isRefreshing = false;
let queue = [];

const processQueue = (error, token = null) => {
  queue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  queue = [];
};

client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const refreshToken = useAuthStore.getState().refreshToken;

    if (error.response?.status === 401 && refreshToken && !originalRequest._retry && !originalRequest.url?.includes('/auth/refresh')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return client(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const activeRoleId = useAuthStore.getState().activeRole?.id || null;
        const response = await axios.post(`${API_BASE}/auth/refresh`, {
          refreshToken,
          ...(activeRoleId ? { roleId: activeRoleId } : {}),
        });
        const nextToken = response.data.accessToken;
        useAuthStore.getState().setSession({
          user: response.data.user || useAuthStore.getState().user,
          accessToken: nextToken,
          refreshToken,
          roles: response.data.roles,
          activeRole: response.data.activeRole,
          activeRoleId: response.data.activeRoleId,
        });
        processQueue(null, nextToken);
        originalRequest.headers.Authorization = `Bearer ${nextToken}`;
        return client(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
      } finally {
        isRefreshing = false;
      }
    }

    // Attach human-readable message so components can use err.userMessage
    error.userMessage = extractError(error);
    return Promise.reject(error);
  }
);

export default client;
