export type ParentKind = "biological" | "adoptive" | "step" | "guardian";
export type SpouseStatus = "current" | "former" | "unknown";
export type Confidence = "confirmed" | "probable" | "uncertain";
export type DataStatus = "confirmed" | "needs_review" | "test";

export interface ParentLink {
  parentId: string;
  kind: ParentKind;
  confidence: Confidence;
}

export interface SpouseLink {
  spouseId: string;
  status: SpouseStatus;
  confidence: Confidence;
}

export interface Person {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  maidenName?: string;
  gender?: "male" | "female" | "other" | "unknown";
  birthDate?: string;
  birthYear?: number;
  deathDate?: string;
  deathYear?: number;
  birthPlace?: string;
  biography?: string;
  isLiving?: boolean;
  dataStatus?: DataStatus;
  notes?: string;
  relationshipLabel: string;
  parentIds: string[];
  parentLinks?: ParentLink[];
  /** Primary/current spouse for backward-compatible layout and forms. */
  spouseId?: string;
  spouseIds?: string[];
  spouseLinks?: SpouseLink[];
  childIds: string[];
  /** Relative Storage path inside person-photos. Never a signed URL. */
  photoPath?: string | null;
  photoUpdatedAt?: string | null;
  /** UI-only signed URL — never persisted to Supabase. */
  photoUrl?: string | null;
  isCurrentUser?: boolean;
  /** Import key for stable deep-links; not shown in UI. */
  externalKey?: string;
}

export type RelationshipType = "parent-child" | "spouse";

export interface FamilyRelationship {
  id: string;
  type: RelationshipType;
  sourceId: string;
  targetId: string;
  parentKind?: ParentKind;
  spouseStatus?: SpouseStatus;
  confidence?: Confidence;
}

export interface PersonNodeData extends Record<string, unknown> {
  person: Person;
  onSelect: (personId: string) => void;
  isHighlighted?: boolean;
  isFocused?: boolean;
  isSelected?: boolean;
  isSearchFlash?: boolean;
  isRelated?: boolean;
  isDimmed?: boolean;
  isOnFocusedPath?: boolean;
  isHoverRelated?: boolean;
  isCompact?: boolean;
  detailLevel?: "overview" | "compact" | "full";
  isCollapsed?: boolean;
  hiddenDescendantCount?: number;
  canCollapse?: boolean;
  onToggleCollapse?: (personId: string) => void;
  /** Heritage tree mode: children above, roots below. */
  treeOrientation?: boolean;
  /** Botanical tree mode: central focus person. */
  isBotanicalCentral?: boolean;
  isBotanicalSpouse?: boolean;
  botanicalDisplayLevel?: "central" | "primary" | "normal";
  /** Heritage tree: name plaque above or below medallion. */
  labelPlacement?: "top" | "bottom";
  /** Short relation to current tree center, e.g. «дочь». */
  relationToFocusLabel?: string;
}
