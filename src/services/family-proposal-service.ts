import { getSupabaseClient } from "@/lib/supabase/client";
import {
  mapAdminProposalListFromRpc,
  mapAdminUsersFromRpc,
  mapAuditLogFromRpc,
  mapProposalFromRpc,
  mapProposalListFromRpc,
  mapProposalMessagesFromRpc,
} from "@/lib/family-proposal-mapper";
import {
  parseProposalPayload,
  proposalReasonSchema,
  proposalSourceNoteSchema,
} from "@/lib/family-proposal-schema";
import { FamilyDataError, mapRpcError } from "@/services/family-service";
import type {
  AdminProposalListItem,
  AdminUserListItem,
  AuditLogEntry,
  FamilyChangeProposal,
  ProposalMessage,
  ProposalType,
  ReviewAction,
} from "@/types/family-proposal";
import type { UserRole } from "@/lib/permissions";

export class ProposalServiceError extends FamilyDataError {
  constructor(message: string) {
    super(message);
    this.name = "ProposalServiceError";
  }
}

function requireClient() {
  const client = getSupabaseClient();
  if (!client) {
    throw new ProposalServiceError(
      "Предложения недоступны: используются локальные тестовые данные",
    );
  }
  return client;
}

export async function submitFamilyChangeProposal(input: {
  proposalType: ProposalType;
  targetPersonId?: string | null;
  targetRelationshipId?: string | null;
  payload: unknown;
  reason?: string | null;
  sourceNote?: string | null;
}): Promise<FamilyChangeProposal> {
  const client = requireClient();
  parseProposalPayload(input.proposalType, input.payload);
  const reason = proposalReasonSchema.parse(input.reason ?? null);
  const sourceNote = proposalSourceNoteSchema.parse(input.sourceNote ?? null);

  const { data, error } = await client.rpc("submit_family_change_proposal", {
    proposal_type: input.proposalType,
    target_person_id: input.targetPersonId ?? null,
    target_relationship_id: input.targetRelationshipId ?? null,
    payload: input.payload as Record<string, unknown>,
    reason,
    source_note: sourceNote,
  });

  if (error) {
    throw new ProposalServiceError(
      mapRpcError(error.message, "Не удалось отправить предложение"),
    );
  }

  return mapProposalFromRpc(data);
}

export async function listMyFamilyChangeProposals(): Promise<
  FamilyChangeProposal[]
> {
  const client = requireClient();
  const { data, error } = await client.rpc("list_my_family_change_proposals");
  if (error) {
    throw new ProposalServiceError(
      mapRpcError(error.message, "Не удалось загрузить предложения"),
    );
  }
  return mapProposalListFromRpc(data);
}

export async function cancelMyFamilyChangeProposal(
  proposalId: string,
): Promise<FamilyChangeProposal> {
  const client = requireClient();
  const { data, error } = await client.rpc("cancel_my_family_change_proposal", {
    proposal_id: proposalId,
  });
  if (error) {
    throw new ProposalServiceError(
      mapRpcError(error.message, "Не удалось отменить предложение"),
    );
  }
  return mapProposalFromRpc(data);
}

export async function resubmitFamilyChangeProposal(input: {
  proposalId: string;
  newPayload: unknown;
  responseComment?: string | null;
}): Promise<FamilyChangeProposal> {
  const client = requireClient();
  const { data, error } = await client.rpc("resubmit_family_change_proposal", {
    proposal_id: input.proposalId,
    new_payload: input.newPayload as Record<string, unknown>,
    response_comment: input.responseComment ?? null,
  });
  if (error) {
    throw new ProposalServiceError(
      mapRpcError(error.message, "Не удалось отправить уточнение"),
    );
  }
  return mapProposalFromRpc(data);
}

export async function adminListFamilyChangeProposals(input?: {
  statusFilter?: string | null;
  typeFilter?: string | null;
  limit?: number;
  offset?: number;
}): Promise<AdminProposalListItem[]> {
  const client = requireClient();
  const { data, error } = await client.rpc("admin_list_family_change_proposals", {
    status_filter: input?.statusFilter ?? null,
    type_filter: input?.typeFilter ?? null,
    limit_count: input?.limit ?? 50,
    offset_count: input?.offset ?? 0,
  });
  if (error) {
    throw new ProposalServiceError(
      mapRpcError(error.message, "Не удалось загрузить предложения"),
    );
  }
  return mapAdminProposalListFromRpc(data);
}

export async function adminCountPendingProposals(): Promise<number> {
  const client = requireClient();
  const { data, error } = await client.rpc("admin_count_pending_proposals");
  if (error) {
    return 0;
  }
  return typeof data === "number" ? data : 0;
}

export async function reviewFamilyChangeProposal(input: {
  proposalId: string;
  action: ReviewAction;
  adminComment?: string | null;
  confirmDuplicates?: boolean;
}): Promise<FamilyChangeProposal> {
  const client = requireClient();
  const { data, error } = await client.rpc("review_family_change_proposal", {
    proposal_id: input.proposalId,
    action: input.action,
    admin_comment: input.adminComment ?? null,
    confirm_duplicates: input.confirmDuplicates ?? false,
  });
  if (error) {
    throw new ProposalServiceError(
      mapRpcError(error.message, "Не удалось обработать предложение"),
    );
  }
  return mapProposalFromRpc(data);
}

export async function approvePhotoChangeProposal(input: {
  proposalId: string;
  officialPhotoPath: string;
  adminComment?: string | null;
}): Promise<{
  proposal: FamilyChangeProposal;
  previousPhotoPath: string | null;
}> {
  const client = requireClient();
  const { data, error } = await client.rpc("approve_photo_change_proposal", {
    proposal_id: input.proposalId,
    official_photo_path: input.officialPhotoPath,
    admin_comment: input.adminComment ?? null,
  });
  if (error) {
    throw new ProposalServiceError(
      mapRpcError(error.message, "Не удалось принять фотографию"),
    );
  }
  const row =
    data && typeof data === "object"
      ? (data as Record<string, unknown>)
      : null;
  if (!row) {
    throw new ProposalServiceError("Не удалось принять фотографию");
  }
  return {
    proposal: mapProposalFromRpc(row.proposal ?? row),
    previousPhotoPath:
      typeof row.previous_photo_path === "string"
        ? row.previous_photo_path
        : null,
  };
}

export async function adminListUsers(): Promise<AdminUserListItem[]> {
  const client = requireClient();
  const { data, error } = await client.rpc("admin_list_users");
  if (error) {
    throw new ProposalServiceError(
      mapRpcError(error.message, "Не удалось загрузить пользователей"),
    );
  }
  return mapAdminUsersFromRpc(data);
}

export async function adminSetUserRole(
  targetUserId: string,
  newRole: UserRole,
): Promise<AdminUserListItem> {
  const client = requireClient();
  const { data, error } = await client.rpc("admin_set_user_role", {
    target_user_id: targetUserId,
    new_role: newRole,
  });
  if (error) {
    throw new ProposalServiceError(
      mapRpcError(error.message, "Не удалось изменить роль"),
    );
  }
  const users = mapAdminUsersFromRpc([data]);
  if (users.length === 0) {
    throw new ProposalServiceError("Не удалось изменить роль");
  }
  return users[0];
}

export async function adminListAuditLog(input?: {
  limit?: number;
  offset?: number;
}): Promise<AuditLogEntry[]> {
  const client = requireClient();
  const { data, error } = await client.rpc("admin_list_audit_log", {
    limit_count: input?.limit ?? 100,
    offset_count: input?.offset ?? 0,
  });
  if (error) {
    throw new ProposalServiceError(
      mapRpcError(error.message, "Не удалось загрузить журнал"),
    );
  }
  return mapAuditLogFromRpc(data);
}

export async function getProposalMessages(
  proposalId: string,
): Promise<ProposalMessage[]> {
  const client = requireClient();
  const { data, error } = await client.rpc("list_proposal_messages", {
    proposal_id: proposalId,
  });
  if (error) {
    throw new ProposalServiceError(
      mapRpcError(error.message, "Не удалось загрузить сообщения"),
    );
  }
  return mapProposalMessagesFromRpc(data);
}
