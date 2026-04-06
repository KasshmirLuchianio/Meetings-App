import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/config';

const TOKEN_KEY = 'auth_token';

let logoutCallback: (() => void) | null = null;

export function setLogoutCallback(cb: () => void) {
  logoutCallback = cb;
}

async function refreshToken(currentToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: currentToken }),
    });
    if (res.ok) {
      const data = await res.json();
      await SecureStore.setItemAsync(TOKEN_KEY, data.token);
      return data.token;
    }
    return null;
  } catch {
    return null;
  }
}

export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) {
    logoutCallback?.();
    throw new Error('Nu ești autentificat');
  }

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    // Try token refresh
    const newToken = await refreshToken(token);
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      return fetch(url, { ...options, headers });
    }
    // Refresh failed — force logout
    logoutCallback?.();
    throw new Error('Sesiune expirată');
  }

  return res;
}
