import { Center, Loader } from '@mantine/core';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { api, refreshSession, setSessionExpiredHandler } from './api';
import { AuthContext } from './auth-context';
import type { User } from './types';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  // Restore the session from the refresh cookie on page load.
  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));
    refreshSession()
      .then((session) => setUser(session?.user ?? null))
      .finally(() => setChecking(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setUser((await api.login(email, password)).user);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  if (checking) {
    return (
      <Center h="100vh">
        <Loader color="apple" />
      </Center>
    );
  }
  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}
