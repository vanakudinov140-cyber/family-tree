import type {
  AdminProposalListItem,
  AdminUserListItem,
  AuditLogEntry,
  FamilyChangeProposal,
  ProposalMessage,
  ProposalPayload,
  ProposalStatus,
  ProposalType,
} from "@/types/family-proposal";
import type { UserRole } from "@/lib/permissions";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function mapProposalRow(row: Record<string, unknown>): FamilyChangeProposal {
  return {
    id: String(row.id),
    submittedBy: String(row.submitted_by),
    proposalType: row.proposal_type as ProposalType,
    targetPersonId:
      typeof row.target_person_id === "string" ? row.target_person_id : null,
    targetRelationshipId:
      typeof row.target_relationship_id === "string"
        ? row.target_relationship_id
        : null,
    payload: row.payload as ProposalPayload,
    reason: typeof row.reason === "string" ? row.reason : null,
    sourceNote: typeof row.source_note === "string" ? row.source_note : null,
    status: row.status as ProposalStatus,
    adminComment:
      typeof row.admin_comment === "string" ? row.admin_comment : null,
    reviewedBy: typeof row.reviewed_by === "string" ? row.reviewed_by : null,
    reviewedAt: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    version: typeof row.version === "number" ? row.version : 1,
  };
}

export function mapProposalFromRpc(data: unknown): FamilyChangeProposal {
  const row = asRecord(data);
  if (!row) {
    throw new Error("Некорректный ответ предложения");
  }
  return mapProposalRow(row);
}

export function mapProposalListFromRpc(data: unknown): FamilyChangeProposal[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map(mapProposalRow);
}

export function mapAdminProposalListFromRpc(
  data: unknown,
): AdminProposalListItem[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => ({
      ...mapProposalRow(item),
      targetPersonName:
        typeof item.target_person_name === "string"
          ? item.target_person_name
          : null,
      submitterEmail:
        typeof item.submitter_email === "string" ? item.submitter_email : null,
      submitterName:
        typeof item.submitter_name === "string" ? item.submitter_name : null,
    }));
}

export function mapProposalMessagesFromRpc(data: unknown): ProposalMessage[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => ({
      id: String(item.id),
      proposalId: String(item.proposal_id),
      authorId: String(item.author_id),
      message: String(item.message),
      createdAt: String(item.created_at),
    }));
}

export function mapAdminUsersFromRpc(data: unknown): AdminUserListItem[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => ({
      userId: String(item.user_id),
      email: typeof item.email === "string" ? item.email : null,
      role: (item.role as UserRole) ?? "relative",
      createdAt: typeof item.created_at === "string" ? item.created_at : null,
      lastSignInAt:
        typeof item.last_sign_in_at === "string" ? item.last_sign_in_at : null,
      confirmedAt:
        typeof item.confirmed_at === "string" ? item.confirmed_at : null,
    }));
}

export function mapAuditLogFromRpc(data: unknown): AuditLogEntry[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => ({
      id: String(item.id),
      actorUserId:
        typeof item.actor_user_id === "string" ? item.actor_user_id : null,
      action: String(item.action),
      entityType: String(item.entity_type),
      entityId: typeof item.entity_id === "string" ? item.entity_id : null,
      beforeData: asRecord(item.before_data),
      afterData: asRecord(item.after_data),
      metadata: asRecord(item.metadata),
      createdAt: String(item.created_at),
    }));
}
