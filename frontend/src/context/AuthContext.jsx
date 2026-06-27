import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('suitesops_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('suitesops_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then(({ data }) => {
        setUser(data.user);
        localStorage.setItem('suitesops_user', JSON.stringify(data.user));
      })
      .catch(() => {
        localStorage.removeItem('suitesops_token');
        localStorage.removeItem('suitesops_user');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('suitesops_token', data.token);
    localStorage.setItem('suitesops_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem('suitesops_token');
    localStorage.removeItem('suitesops_user');
    setUser(null);
  }

  const isManager = user?.role === 'manager';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isManager }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
