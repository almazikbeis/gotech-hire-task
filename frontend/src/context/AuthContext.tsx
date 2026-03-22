import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { AuthUser } from '../types';

interface AuthContextValue {
  auth: AuthUser | null;
  login: (token: string, userId: number) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthUser | null>(() => {
    const token = localStorage.getItem('token');
    const rawUserId = localStorage.getItem('userId');
    if (token && rawUserId) {
      return { token, userId: parseInt(rawUserId, 10) };
    }
    return null;
  });

  const login = useCallback((token: string, userId: number) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', String(userId));
    setAuth({ token, userId });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    setAuth(null);
  }, []);

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
