import api, { refreshApi } from './axios';

// Decode JWT without external deps
const decodeJwt = (token) => {
  try {
    const [, payload] = token.split('.');
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
};

export const getTokenExpiry = (token) => {
  const decoded = decodeJwt(token);
  return decoded?.exp ? decoded.exp * 1000 : null;
};

// Login
export const loginAPI = async (credentials) => {
  const { data } = await refreshApi.post('/auth/login', credentials);
  return data; 
};

// Refresh
export const refreshAPI = async () => {
  const { data } = await refreshApi.post('/auth/refresh');
  return data; 
};

// Logout
export const logoutAPI = async () => {
  try {
    await refreshApi.post('/auth/logout');
  } catch (_) {
  }
};
