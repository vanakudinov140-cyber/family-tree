import type { FamilyDataSource } from "@/services/family-service";
import type { ProfileRole } from "@/lib/supabase/types";
import {
  canDeletePeople,
  canEditFamily,
  canSuggestChanges,
} from "@/lib/permissions";

export type PersonPanelActions = {
  canAddRelative: boolean;
  canEditPerson: boolean;
  canDeletePerson: boolean;
  canChangePhoto: boolean;
  canSuggestChange: boolean;
};

/**
 * Panel actions depend on Auth role + data source, never on focused/selected/
 * linked person ids. Empty linkedPersonId must not hide admin/editor actions.
 */
export function resolvePersonPanelActions(input: {
  role: ProfileRole | null;
  isAuthenticated: boolean;
  source: FamilyDataSource | null;
}): PersonPanelActions {
  const { role, isAuthenticated, source } = input;
  const onSupabase = source === "supabase" && isAuthenticated;

  if (!onSupabase) {
    return {
      canAddRelative: false,
      canEditPerson: false,
      canDeletePerson: false,
      canChangePhoto: false,
      canSuggestChange: false,
    };
  }

  const edit = canEditFamily(role);
  const del = canDeletePeople(role);
  const suggest = canSuggestChanges(role);

  return {
    canAddRelative: edit,
    canEditPerson: edit,
    canDeletePerson: del,
    canChangePhoto: edit || role === "relative",
    canSuggestChange: suggest && !edit,
  };
}
