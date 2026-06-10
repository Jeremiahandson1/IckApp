import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { getStoredToken, setStoredToken, removeStoredToken } from '../utils/tokenStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearAuth = useCallback(() => {
    removeStoredToken('token');
    removeStoredToken('refreshToken');
    api.setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    // Listen for auth failures from the API client (e.g. unrecoverable 401)
    const handleAuthLogout = () => clearAuth();
    window.addEventListener('auth:logout', handleAuthLogout);
    return () => window.removeEventListener('auth:logout', handleAuthLogout);
  }, [clearAuth]);

  useEffect(() => {
    const token = getStoredToken('token');
    if (token) {
      fetchProfile(token);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchProfile = async (token) => {
    try {
      api.setToken(token);
      const data = await api.get('/auth/profile');
      setUser(data.user);
    } catch (error) {
      // Token invalid and refresh also failed — clear everything
      clearAuth();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    setStoredToken('token', data.token);
    if (data.refreshToken) setStoredToken('refreshToken', data.refreshToken);
    api.setToken(data.token);
    setUser(data.user);
    return data;
  };

  const register = async (userData) => {
    const data = await api.post('/auth/register', userData);
    setStoredToken('token', data.token);
    if (data.refreshToken) setStoredToken('refreshToken', data.refreshToken);
    api.setToken(data.token);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    const refreshToken = getStoredToken('refreshToken');
    if (refreshToken) {
      // Tell the server to revoke this refresh token (fire and forget)
      api.post('/auth/logout', { refreshToken }).catch(() => {});
    }
    clearAuth();
  };

  const updateProfile = async (updates) => {
    const data = await api.put('/auth/profile', updates);
    setUser(data.user);
    return data;
  };

  const refreshProfile = async () => {
    const token = getStoredToken('token');
    if (token) await fetchProfile(token);
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateProfile,
    refreshProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}


