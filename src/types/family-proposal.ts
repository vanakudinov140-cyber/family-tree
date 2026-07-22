import type { UserRole } from "@/lib/permissions";

export type ProposalType =
  | "person_update"
  | "person_create"
  | "relationship_create"
  | "relationship_update"
  | "photo_replace";

export type ProposalStatus =
  | "pending"
  | "needs_info"
  | "approved"
  | "rejected"
  | "cancelled";

export type ReviewAction = "approve" | "reject" | "request_info";

export interface PersonUpdateChanges {
  firstName?: string;
  middleName?: string | null;
  lastName?: string | null;
  maidenName?: string | null;
  birthDate?: string | null;
  birthYear?: number | null;
  deathDate?: string | null;
  deathYear?: number | null;
  birthPlace?: string | null;
  biography?: string | null;
  isLiving?: boolean | null;
  notes?: string | null;
}

export interface PersonUpdatePayload {
  changes: PersonUpdateChanges;
}

export interface PersonCreatePayloadPerson {
  firstName: string;
  middleName?: string | null;
  lastName?: string | null;
  maidenName?: string | null;
  gender: "male" | "female" | "other" | "unknown";
  birthDate?: string | null;
  birthYear?: number | null;
  deathDate?: string | null;
  deathYear?: number | null;
  birthPlace?: string | null;
  biography?: string | null;
  isLiving?: boolean | null;
  notes?: string | null;
}

export interface PersonCreatePayloadRelation {
  anchorPersonId: string;
  type: "parent" | "child" | "spouse";
  parentKind?: "biological" | "adoptive" | "step" | "guardian" | null;
  spouseStatus?: "current" | "former" | "unknown" | null;
  confidence?: "confirmed" | "probable" | "uncertain";
}

export interface PersonCreatePayload {
  person: PersonCreatePayloadPerson;
  relation: PersonCreatePayloadRelation;
}

export interface RelationshipCreatePayload {
  person1Id: string;
  person2Id: string;
  relationshipType: "parent" | "spouse";
  parentKind?: "biological" | "adoptive" | "step" | "guardian" | null;
  spouseStatus?: "current" | "former" | "unknown" | null;
  confidence?: "confirmed" | "probable" | "uncertain";
  notes?: string | null;
}

export interface RelationshipUpdateChanges {
  person1Id?: string;
  person2Id?: string;
  parentKind?: "biological" | "adoptive" | "step" | "guardian" | null;
  spouseStatus?: "current" | "former" | "unknown" | null;
  confidence?: "confirmed" | "probable" | "uncertain";
  notes?: string | null;
}

export interface RelationshipUpdatePayload {
  relationshipId: string;
  changes: RelationshipUpdateChanges;
}

export interface PhotoReplacePayload {
  proposalPhotoPath: string;
}

export type ProposalPayload =
  | PersonUpdatePayload
  | PersonCreatePayload
  | RelationshipCreatePayload
  | RelationshipUpdatePayload
  | PhotoReplacePayload;

export interface FamilyChangeProposal {
  id: string;
  submittedBy: string;
  proposalType: ProposalType;
  targetPersonId: string | null;
  targetRelationshipId: string | null;
  payload: ProposalPayload;
  reason: string | null;
  sourceNote: string | null;
  status: ProposalStatus;
  adminComment: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ProposalMessage {
  id: string;
  proposalId: string;
  authorId: string;
  message: string;
  createdAt: string;
}

export interface AdminProposalListItem extends FamilyChangeProposal {
  targetPersonName?: string | null;
  submitterEmail?: string | null;
  submitterName?: string | null;
}

export interface AdminUserListItem {
  userId: string;
  email: string | null;
  role: UserRole;
  createdAt: string | null;
  lastSignInAt: string | null;
  confirmedAt: string | null;
}

export interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
