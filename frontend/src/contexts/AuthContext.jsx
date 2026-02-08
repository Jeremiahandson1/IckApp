import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored token on mount
    const token = localStorage.getItem('token');
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

      // Silently refresh token to extend session
      try {
        const refreshData = await api.post('/auth/refresh');
        if (refreshData.token) {
          localStorage.setItem('token', refreshData.token);
          api.setToken(refreshData.token);
        }
      } catch (e) {
        // Non-critical - old token still works
      }
    } catch (error) {
      // Token invalid, clear it
      localStorage.removeItem('token');
      api.setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    api.setToken(data.token);
    setUser(data.user);
    return data;
  };

  const register = async (userData) => {
    const data = await api.post('/auth/register', userData);
    localStorage.setItem('token', data.token);
    api.setToken(data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    api.setToken(null);
    setUser(null);
  };

  const updateProfile = async (updates) => {
    const data = await api.put('/auth/profile', updates);
    setUser(data.user);
    return data;
  };

  const refreshProfile = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      await fetchProfile(token);
    }
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
