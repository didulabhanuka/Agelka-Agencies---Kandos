import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginAPI, refreshAPI, logoutAPI, getTokenExpiry } from '../lib/api/auth.api';
import { setAccessToken } from '../lib/api/axios';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const refreshTimer = useRef(null);

  const clearRefreshTimer = () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  };

  const scheduleTokenRefresh = useCallback((token) => {
    clearRefreshTimer();
    const expiry = getTokenExpiry(token);
    if (!expiry) return;
    const delay = Math.max(expiry - Date.now() - 60000, 5000);
    refreshTimer.current = setTimeout(async () => {
      try {
        const { accessToken, user } = await refreshAPI();
        setAccessToken(accessToken);
        setUser(user);
        scheduleTokenRefresh(accessToken);
      } catch {
        await logout();
      }
    }, delay);
  }, []);

  useEffect(() => () => clearRefreshTimer(), []);

  // Silent login on mount
  useEffect(() => {
    (async () => {
      try {
        const { accessToken, user } = await refreshAPI();
        setAccessToken(accessToken);
        setUser(user);
        scheduleTokenRefresh(accessToken);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [scheduleTokenRefresh]);

  const login = useCallback(
    async (credentials) => {
      const { user, accessToken } = await loginAPI(credentials);
      setAccessToken(accessToken);
      setUser(user);
      scheduleTokenRefresh(accessToken);
      navigate('/');
    },
    [navigate, scheduleTokenRefresh]
  );

  const logout = useCallback(async () => {
    clearRefreshTimer();
    await logoutAPI();
    setAccessToken(null);
    setUser(null);
    navigate('/login');
  }, [navigate]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
