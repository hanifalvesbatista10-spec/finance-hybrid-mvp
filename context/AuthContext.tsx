"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createClient,
  type Session,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

export type ProfileRole = "PERSONAL" | "INSTITUTIONAL";

export interface Profile {
  id: string;
  full_name: string;
  role: ProfileRole;
  created_at?: string;
  updated_at?: string;
}

interface AuthContextValue {
  supabase: SupabaseClient;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "As variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórias.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function getProfile(
  client: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await client
    .from("profiles")
    .select("id, full_name, role, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Profile | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const loadedProfile = await getProfile(supabase, userId);
      setProfile(loadedProfile);
    } catch (error) {
      console.error("Não foi possível carregar o perfil:", error);
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user.id) {
      setProfile(null);
      return;
    }

    await loadProfile(session.user.id);
  }, [loadProfile, session?.user.id]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    setSession(null);
    setProfile(null);
  }, []);

  useEffect(() => {
    let active = true;

    const initializeAuth = async () => {
      setLoading(true);

      const {
        data: { session: initialSession },
        error,
      } = await supabase.auth.getSession();

      if (!active) return;

      if (error) {
        console.error("Erro ao recuperar sessão:", error);
        setSession(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setSession(initialSession);

      if (initialSession?.user.id) {
        await loadProfile(initialSession.user.id);
      } else {
        setProfile(null);
      }

      if (active) setLoading(false);
    };

    void initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Evita chamadas assíncronas diretamente dentro do callback do Supabase.
      window.setTimeout(() => {
        if (!active) return;

        setSession(nextSession);

        if (nextSession?.user.id) {
          void loadProfile(nextSession.user.id).finally(() => {
            if (active) setLoading(false);
          });
        } else {
          setProfile(null);
          setLoading(false);
        }
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      supabase,
      session,
      user: session?.user ?? null,
      profile,
      loading,
      refreshProfile,
      signOut,
    }),
    [loading, profile, refreshProfile, session, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser utilizado dentro de AuthProvider.");
  }

  return context;
}
