import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, PricingTier } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updatePlan: (plan: PricingTier) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  updatePlan: () => {},
});

const AUTH_KEY = 'auth_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const saved = await AsyncStorage.getItem(AUTH_KEY);
      if (saved) {
        setUser(JSON.parse(saved));
      }
    } catch {
      // No saved user
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, _password: string) => {
    // TODO: Replace with real API call when backend auth is ready
    const mockUser: User = {
      _id: Date.now().toString(),
      email,
      name: email.split('@')[0],
      plan: 'FREE',
      meetings_used_this_month: 0,
      created_at: new Date().toISOString(),
    };
    setUser(mockUser);
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(mockUser));
  };

  const register = async (name: string, email: string, _password: string) => {
    // TODO: Replace with real API call when backend auth is ready
    const mockUser: User = {
      _id: Date.now().toString(),
      email,
      name,
      plan: 'FREE',
      meetings_used_this_month: 0,
      created_at: new Date().toISOString(),
    };
    setUser(mockUser);
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(mockUser));
  };

  const logout = async () => {
    setUser(null);
    await AsyncStorage.removeItem(AUTH_KEY);
  };

  const updatePlan = (plan: PricingTier) => {
    if (user) {
      const updated = { ...user, plan };
      setUser(updated);
      AsyncStorage.setItem(AUTH_KEY, JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        updatePlan,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
