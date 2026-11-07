import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { getMe, type AuthResult, type User } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { apiOrigin, configurationError } from '@/lib/config';
import { errorMessage, setToken, setUnauthorizedHandler } from '@/lib/client';

type AuthContextValue = {
  user: User | null; restoring: boolean; restoreError: string | null; notice: string | null;
  acceptSession: (result: AuthResult) => Promise<void>;
  signOut: () => Promise<void>; restore: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);
const KEY = 'nagardrishti.session.v1';
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const generation = useRef(0);

  const signOut = useCallback(async () => {
    generation.current += 1;
    setToken(null); setUser(null); setRestoreError(null); setRestoring(false);
    await queryClient.cancelQueries();
    queryClient.clear();
    if (Platform.OS !== 'web') {
      try { await SecureStore.deleteItemAsync(KEY); }
      catch { setNotice('Signed out here. Secure storage could not be cleared; restart and sign out again before sharing this device.'); }
    }
  }, [queryClient]);
  useEffect(() => {
    setUnauthorizedHandler(() => { setNotice('Your session has expired. Sign in again.'); void signOut(); });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const acceptSession = useCallback(async (result: AuthResult) => {
    if (!['citizen', 'contractor'].includes(result.user.role)) {
      throw new Error('This mobile app supports citizens and contractors. Junior Engineers and commissioners should use the web dashboard.');
    }
    await queryClient.cancelQueries(); queryClient.clear();
    if (Platform.OS !== 'web') {
      await SecureStore.setItemAsync(KEY, JSON.stringify({ origin: apiOrigin, token: result.access_token }));
    }
    generation.current += 1;
    setToken(result.access_token); setUser(result.user); setNotice(null); setRestoreError(null);
  }, [queryClient]);

  const restore = useCallback(async () => {
    const attempt = ++generation.current;
    setRestoring(true); setRestoreError(null);
    try {
      if (configurationError || Platform.OS === 'web') return;
      const saved = await SecureStore.getItemAsync(KEY);
      if (!saved) return;
      let session: { origin?: string; token?: string };
      try { session = JSON.parse(saved); } catch { await SecureStore.deleteItemAsync(KEY); return; }
      if (session.origin !== apiOrigin || typeof session.token !== 'string') { await SecureStore.deleteItemAsync(KEY); return; }
      setToken(session.token);
      const profile = await getMe();
      if (attempt !== generation.current) return;
      if (!['citizen', 'contractor'].includes(profile.role)) { await signOut(); return; }
      setUser(profile);
    } catch (error) {
      if (attempt === generation.current) setRestoreError(errorMessage(error));
    } finally {
      if (attempt === generation.current) setRestoring(false);
    }
  }, [signOut]);
  useEffect(() => { void restore(); }, [restore]);

  return <AuthContext.Provider value={{ user, restoring, restoreError, notice, acceptSession, signOut, restore }}>
    {children}
  </AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is missing.');
  return context;
}
