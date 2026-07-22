import type { AuthError, Session, User } from "@supabase/supabase-js";

import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { DbProfile, ProfileRole } from "@/lib/supabase/types";

export class AuthServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthServiceError";
  }
}

function mapAuthError(error: AuthError): string {
  const message = error.message.toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "Неверный email или пароль";
  }
  if (message.includes("email not confirmed")) {
    return "Подтвердите email по ссылке из письма, затем войдите снова";
  }
  if (message.includes("user already registered")) {
    return "Пользователь с таким email уже зарегистрирован";
  }
  if (message.includes("password should be at least")) {
    return "Пароль слишком короткий";
  }
  if (message.includes("unable to validate email")) {
    return "Проверьте правильность email";
  }
  if (message.includes("signup is disabled")) {
    return "Регистрация временно отключена в проекте Supabase";
  }

  return error.message || "Не удалось выполнить действие авторизации";
}

export async function signUp(input: {
  email: string;
  password: string;
  fullName?: string;
}): Promise<{ user: User | null; session: Session | null }> {
  const client = getSupabaseClient();
  if (!client) {
    throw new AuthServiceError("Supabase не настроен");
  }

  const { data, error } = await client.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        full_name: input.fullName?.trim() || "",
      },
    },
  });

  if (error) {
    throw new AuthServiceError(mapAuthError(error));
  }

  return { user: data.user, session: data.session };
}

export async function signIn(input: {
  email: string;
  password: string;
}): Promise<{ user: User; session: Session }> {
  const client = getSupabaseClient();
  if (!client) {
    throw new AuthServiceError("Supabase не настроен");
  }

  const { data, error } = await client.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  });

  if (error) {
    throw new AuthServiceError(mapAuthError(error));
  }

  if (!data.user || !data.session) {
    throw new AuthServiceError("Не удалось войти");
  }

  // Re-read session so subsequent profile queries use the fresh auth token.
  const { data: sessionData, error: sessionError } =
    await client.auth.getSession();
  if (sessionError) {
    throw new AuthServiceError(mapAuthError(sessionError));
  }

  const session = sessionData.session ?? data.session;
  const user = session.user ?? data.user;

  return { user, session };
}

export async function signOut(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    return;
  }

  const { error } = await client.auth.signOut();
  if (error) {
    throw new AuthServiceError(mapAuthError(error));
  }
}

export async function getSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }

  const { data, error } = await client.auth.getSession();
  if (error) {
    throw new AuthServiceError(mapAuthError(error));
  }

  return data.session;
}

/**
 * Loads the app role exclusively from public.profiles.
 * Never use JWT / user_metadata for role checks.
 */
export async function getProfile(userId: string): Promise<DbProfile | null> {
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from("profiles")
    .select("id, email, full_name, role, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    // Profile table may not exist until migration 002 is applied.
    if (error.code === "42P01" || error.message.includes("schema cache")) {
      return null;
    }
    throw new AuthServiceError(error.message);
  }

  if (!data) {
    return null;
  }

  const role: ProfileRole =
    data.role === "admin" || data.role === "editor" || data.role === "relative"
      ? data.role
      : "relative";

  return {
    ...data,
    role,
  };
}

export async function getCurrentRole(
  userId: string,
): Promise<ProfileRole | null> {
  const profile = await getProfile(userId);
  return profile?.role ?? null;
}

export function isAuthAvailable(): boolean {
  return isSupabaseConfigured();
}
