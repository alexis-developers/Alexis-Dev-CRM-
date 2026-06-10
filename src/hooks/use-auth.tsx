"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { authClient } from "@/lib/auth/client";

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  role: string | null;
  is_super_admin?: boolean;
  must_change_password?: boolean;
  ativo?: boolean;
}

interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/profile?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        if (data) setProfile(data);
      }
    } catch (err) {
      console.error("[AuthProvider] fetchProfile error:", err);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const safetyTimer = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 3000);

    const init = async () => {
      try {
        const { data } = await authClient.getSession();
        if (!mounted) return;

        const currentUser = data?.user
          ? { id: data.user.id, email: data.user.email, name: data.user.name }
          : null;

        setUser(currentUser);
        if (currentUser) fetchProfile(currentUser.id);
      } catch (err) {
        console.error("[AuthProvider] init error:", err);
      } finally {
        if (mounted) setLoading(false);
        clearTimeout(safetyTimer);
      }
    };

    init();
    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
    };
  }, []);

  const signOut = useCallback(async () => {
    await authClient.signOut();
    setUser(null);
    setProfile(null);
    window.location.href = "/login";
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    await fetchProfile(user.id);
  }, [user?.id, fetchProfile]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      user: null,
      profile: null,
      loading: false,
      signOut: async () => { window.location.href = "/login"; },
      refreshProfile: async () => {},
    };
  }
  return ctx;
}
