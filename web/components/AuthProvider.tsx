'use client';

import React, { createContext, useCallback, useContext, useLayoutEffect, useState } from 'react';
import i18n from '@/src/i18n';
import {
  api,
  ApiError,
  AuthResponse,
  getStoredUser,
  logoutAndRedirect,
  setAuthSession,
  User,
} from '@/lib/api';

type AuthCtx = {
  user: User | null;
  ready: boolean;
  login: (username: string, password: string, remember?: boolean) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const syncUser = useCallback(() => {
    setUser(getStoredUser());
  }, []);

  useLayoutEffect(() => {
    let cancelled = false;

    async function init() {
      let current = getStoredUser();
      if (!current) {
        try {
          const data = await api<AuthResponse>('/auth/session', { authRedirect: false });
          if (data?.token && data?.user?.username) {
            setAuthSession(data.token, data.user, true);
            current = data.user;
          }
        } catch {
          /* not logged in */
        }
      }
      if (!cancelled) {
        setUser(current);
        setReady(true);
      }
    }

    void init();

    const onAuthChange = () => syncUser();
    window.addEventListener('auth:logout', onAuthChange);
    window.addEventListener('auth:session', onAuthChange);
    window.addEventListener('storage', onAuthChange);
    return () => {
      cancelled = true;
      window.removeEventListener('auth:logout', onAuthChange);
      window.removeEventListener('auth:session', onAuthChange);
      window.removeEventListener('storage', onAuthChange);
    };
  }, [syncUser]);

  const persist = (data: AuthResponse, remember: boolean) => {
    if (!data?.token || !data?.user?.username) {
      throw new ApiError('INVALID_AUTH', i18n.t('auth.invalidAuth'), 0);
    }
    setAuthSession(data.token, data.user, remember);
    setUser(data.user);
  };

  const login = async (username: string, password: string, remember = true) => {
    const data = await api<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, remember }),
    });
    persist(data, remember);
  };

  const register = async (username: string, password: string) => {
    const data = await api<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    persist(data, true);
  };

  const logout = () => {
    void logoutAndRedirect();
  };

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}
