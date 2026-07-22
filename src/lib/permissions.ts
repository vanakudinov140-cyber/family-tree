import type { ProfileRole } from "@/lib/supabase/types";

export type UserRole = ProfileRole;

export function canViewFamily(role: UserRole | null): boolean {
  return role === "relative" || role === "editor" || role === "admin";
}

export function canSuggestChanges(role: UserRole | null): boolean {
  return role === "relative" || role === "editor" || role === "admin";
}

export function canEditFamily(role: UserRole | null): boolean {
  return role === "editor" || role === "admin";
}

export function canDeletePeople(role: UserRole | null): boolean {
  return role === "admin";
}

export function canImportFamily(role: UserRole | null): boolean {
  return role === "admin";
}

export function canReviewProposals(role: UserRole | null): boolean {
  return role === "admin";
}

export function canManageUsers(role: UserRole | null): boolean {
  return role === "admin";
}

export function canViewAuditLog(role: UserRole | null): boolean {
  return role === "admin";
}

export function roleLabel(role: UserRole | null): string {
  switch (role) {
    case "admin":
      return "администратор";
    case "editor":
      return "редактор";
    case "relative":
      return "родственник";
    default:
      return "гость";
  }
}
