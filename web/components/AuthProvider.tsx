'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, ApiError, AuthResponse, clearAuthToken, getToken, setToken, TOKEN_KEY, USER_KEY, User } from '@/lib/api';

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthCtx | null>(null);

function readStoredUser(): User | null {
  const token = getToken();
  const raw = localStorage.getItem(USER_KEY);
  if (!token || !raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = readStoredUser();
    if (stored) {
      setUser(stored);
    } else {
      clearAuthToken();
    }
    setLoading(false);

    const onLogout = () => setUser(null);
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, []);

  const persist = (data: AuthResponse) => {
    if (!data?.token || !data?.user?.username) {
      throw new ApiError('INVALID_AUTH', '登录响应无效', 0);
    }
    setToken(data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
  };

  const login = async (username: string, password: string) => {
    const data = await api<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    persist(data);
  };

  const register = async (username: string, password: string) => {
    const data = await api<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    persist(data);
  };

  const logout = () => {
    clearAuthToken();
    setUser(null);
    window.location.href = '/login/';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}
