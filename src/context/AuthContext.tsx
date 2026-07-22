"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

import {
  canDeletePeople,
  canEditFamily,
  canImportFamily,
  canManageUsers,
  canReviewProposals,
  canSuggestChanges,
  canViewAuditLog,
  canViewFamily,
} from "@/lib/permissions";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { DbProfile, ProfileRole } from "@/lib/supabase/types";
import {
  getProfile,
  getSession,
  isAuthAvailable,
  signIn as authSignIn,
  signOut as authSignOut,
  signUp as authSignUp,
} from "@/services/auth-service";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: DbProfile | null;
  role: ProfileRole | null;
  /** Supabase Auth user id — not a person in the tree. */
  authenticatedUserId: string | null;
  /** Role from public.profiles — source of panel permissions. */
  authenticatedRole: ProfileRole | null;
  isAdmin: boolean;
  canViewFamily: boolean;
  canSuggestChanges: boolean;
  canEditFamily: boolean;
  canDeletePeople: boolean;
  canImportFamily: boolean;
  canReviewProposals: boolean;
  canManageUsers: boolean;
  canViewAuditLog: boolean;
  roleChangedNotice: string | null;
  clearRoleChangedNotice: () => void;
  isLoading: boolean;
  isAuthConfigured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PROFILE_REFRESH_EVENTS = new Set<AuthChangeEvent>([
  "INITIAL_SESSION",
  "SIGNED_IN",
  "TOKEN_REFRESHED",
  "USER_UPDATED",
]);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<DbProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roleChangedNotice, setRoleChangedNotice] = useState<string | null>(
    null,
  );
  const isAuthConfigured = isAuthAvailable();
  const profileRequestId = useRef(0);
  const userRef = useRef<User | null>(null);
  const previousRoleRef = useRef<ProfileRole | null>(null);

  userRef.current = user;

  const loadProfile = useCallback(async (nextUser: User | null) => {
    const requestId = ++profileRequestId.current;

    if (!nextUser) {
      if (requestId === profileRequestId.current) {
        setProfile(null);
        previousRoleRef.current = null;
      }
      return;
    }

    try {
      const nextProfile = await getProfile(nextUser.id);
      if (requestId !== profileRequestId.current) {
        return;
      }
      const prevRole = previousRoleRef.current;
      if (
        prevRole &&
        nextProfile?.role &&
        prevRole !== nextProfile.role
      ) {
        setRoleChangedNotice("Права изменены. Меню обновлено.");
      }
      previousRoleRef.current = nextProfile?.role ?? null;
      setProfile(nextProfile);
    } catch {
      if (requestId === profileRequestId.current) {
        setProfile(null);
      }
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const currentSession = await getSession();
    const currentUser = currentSession?.user ?? userRef.current;

    if (currentSession) {
      setSession(currentSession);
      setUser(currentSession.user);
    }

    await loadProfile(currentUser);
  }, [loadProfile]);

  useEffect(() => {
    if (!isAuthConfigured) {
      setIsLoading(false);
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled) {
        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (event === "SIGNED_OUT") {
        profileRequestId.current += 1;
        setProfile(null);
        previousRoleRef.current = null;
        setIsLoading(false);
        return;
      }

      if (!PROFILE_REFRESH_EVENTS.has(event)) {
        return;
      }

      window.setTimeout(() => {
        if (cancelled) {
          return;
        }

        void loadProfile(nextSession?.user ?? null).finally(() => {
          if (!cancelled) {
            setIsLoading(false);
          }
        });
      }, 0);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [isAuthConfigured, loadProfile]);

  useEffect(() => {
    const client = getSupabaseClient();
    const currentUser = user;
    if (!client || !currentUser) {
      return;
    }

    const channel = client
      .channel(`profile-role-${currentUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${currentUser.id}`,
        },
        () => {
          void loadProfile(currentUser);
        },
      )
      .subscribe();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshProfile();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      void client.removeChannel(channel);
    };
  }, [loadProfile, refreshProfile, user]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      profileRequestId.current += 1;
      setProfile(null);
      previousRoleRef.current = null;
      setIsLoading(true);

      try {
        const result = await authSignIn({ email, password });
        setSession(result.session);
        setUser(result.user);
        await loadProfile(result.user);
      } finally {
        setIsLoading(false);
      }
    },
    [loadProfile],
  );

  const signUp = useCallback(
    async (email: string, password: string, fullName?: string) => {
      profileRequestId.current += 1;
      setProfile(null);
      previousRoleRef.current = null;
      setIsLoading(true);

      try {
        const result = await authSignUp({ email, password, fullName });
        setSession(result.session);
        setUser(result.user ?? null);
        await loadProfile(result.user);
      } finally {
        setIsLoading(false);
      }
    },
    [loadProfile],
  );

  const signOut = useCallback(async () => {
    profileRequestId.current += 1;
    setProfile(null);
    previousRoleRef.current = null;
    setUser(null);
    setSession(null);
    await authSignOut();
    setProfile(null);
    setUser(null);
    setSession(null);
  }, []);

  const role = profile?.role ?? null;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      role,
      authenticatedUserId: user?.id ?? null,
      authenticatedRole: role,
      isAdmin: role === "admin",
      canViewFamily: canViewFamily(role),
      canSuggestChanges: canSuggestChanges(role),
      canEditFamily: canEditFamily(role),
      canDeletePeople: canDeletePeople(role),
      canImportFamily: canImportFamily(role),
      canReviewProposals: canReviewProposals(role),
      canManageUsers: canManageUsers(role),
      canViewAuditLog: canViewAuditLog(role),
      roleChangedNotice,
      clearRoleChangedNotice: () => setRoleChangedNotice(null),
      isLoading,
      isAuthConfigured,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [
      isAuthConfigured,
      isLoading,
      profile,
      refreshProfile,
      role,
      roleChangedNotice,
      session,
      signIn,
      signOut,
      signUp,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
