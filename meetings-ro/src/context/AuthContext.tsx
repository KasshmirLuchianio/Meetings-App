import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, PricingTier } from '../types';
import { API_BASE_URL } from '../constants/config';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updatePlan: (plan: PricingTier) => void;
  refreshUsage: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  updatePlan: () => {},
  refreshUsage: async () => {},
});

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      const savedUser = await AsyncStorage.getItem(USER_KEY);

      if (token && savedUser) {
        setAuthToken(token);
        // Verify token is still valid by calling /api/auth/me
        try {
          const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
            await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
          } else {
            // Token expired or invalid — clear session
            setAuthToken(null);
            await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
          }
        } catch {
          // Network error — use cached user data
          setUser(JSON.parse(savedUser));
        }
      }
    } catch {
      // No saved session
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Eroare de conectare' }));
      throw new Error(err.detail || 'Email sau parolă incorectă');
    }

    const data = await res.json();
    setUser(data.user);
    setAuthToken(data.token);
    await AsyncStorage.setItem(TOKEN_KEY, data.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Eroare la înregistrare' }));
      throw new Error(err.detail || 'Nu s-a putut crea contul');
    }

    const data = await res.json();
    setUser(data.user);
    setAuthToken(data.token);
    await AsyncStorage.setItem(TOKEN_KEY, data.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
  };

  const logout = async () => {
    setUser(null);
    setAuthToken(null);
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
  };

  const updatePlan = (plan: PricingTier) => {
    if (user) {
      const updated = { ...user, plan };
      setUser(updated);
      AsyncStorage.setItem(USER_KEY, JSON.stringify(updated));
    }
  };

  const refreshUsage = async () => {
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/me/usage`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (user) {
          const updated = { ...user, meetings_used_this_month: data.meetings_used, plan: data.plan };
          setUser(updated);
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(updated));
        }
      }
    } catch {
      // Silent fail — usage refresh is best-effort
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token: authToken,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        updatePlan,
        refreshUsage,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
