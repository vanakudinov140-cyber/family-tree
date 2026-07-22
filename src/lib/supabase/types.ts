export type Gender = "male" | "female" | "other" | "unknown";
export type DbRelationshipType = "parent" | "spouse";
export type ProfileRole = "relative" | "editor" | "admin";
export type RelationKind =
  | "father"
  | "mother"
  | "spouse"
  | "child"
  | "sibling";

export interface CreateRelativePersonData {
  first_name: string;
  middle_name?: string | null;
  last_name?: string | null;
  maiden_name?: string | null;
  gender: Gender;
  birth_date?: string | null;
  birth_year?: number | null;
  death_date?: string | null;
  death_year?: number | null;
  birth_place?: string | null;
  biography?: string | null;
  is_living?: boolean;
}

export interface UpdatePersonInput {
  first_name: string;
  middle_name?: string | null;
  last_name?: string | null;
  maiden_name?: string | null;
  gender: Gender;
  birth_date?: string | null;
  birth_year?: number | null;
  death_date?: string | null;
  death_year?: number | null;
  birth_place?: string | null;
  biography?: string | null;
  is_living?: boolean;
}

export interface DeletePersonResult {
  deleted_person_id: string;
  deleted_relationships_count: number;
  deleted_photo_path?: string | null;
}

export interface Database {
  public: {
    Tables: {
      people: {
        Row: {
          id: string;
          first_name: string;
          middle_name: string | null;
          last_name: string | null;
          maiden_name: string | null;
          gender: string | null;
          birth_date: string | null;
          birth_year: number | null;
          death_date: string | null;
          death_year: number | null;
          birth_place: string | null;
          biography: string | null;
          photo_url: string | null;
          photo_path: string | null;
          photo_updated_at: string | null;
          is_living: boolean | null;
          external_key: string | null;
          data_status: string | null;
          notes: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          first_name: string;
          middle_name?: string | null;
          last_name?: string | null;
          maiden_name?: string | null;
          gender?: string | null;
          birth_date?: string | null;
          birth_year?: number | null;
          death_date?: string | null;
          death_year?: number | null;
          birth_place?: string | null;
          biography?: string | null;
          photo_url?: string | null;
          photo_path?: string | null;
          photo_updated_at?: string | null;
          is_living?: boolean | null;
          external_key?: string | null;
          data_status?: string | null;
          notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          first_name?: string;
          middle_name?: string | null;
          last_name?: string | null;
          maiden_name?: string | null;
          gender?: string | null;
          birth_date?: string | null;
          birth_year?: number | null;
          death_date?: string | null;
          death_year?: number | null;
          birth_place?: string | null;
          biography?: string | null;
          photo_url?: string | null;
          photo_path?: string | null;
          photo_updated_at?: string | null;
          is_living?: boolean | null;
          external_key?: string | null;
          data_status?: string | null;
          notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      relationships: {
        Row: {
          id: string;
          person1_id: string;
          person2_id: string;
          relationship_type: string;
          parent_kind: string | null;
          spouse_status: string | null;
          confidence: string | null;
          external_key: string | null;
          notes: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          person1_id: string;
          person2_id: string;
          relationship_type: string;
          parent_kind?: string | null;
          spouse_status?: string | null;
          confidence?: string | null;
          external_key?: string | null;
          notes?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          person1_id?: string;
          person2_id?: string;
          relationship_type?: string;
          parent_kind?: string | null;
          spouse_status?: string | null;
          confidence?: string | null;
          external_key?: string | null;
          notes?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "relationships_person1_id_fkey";
            columns: ["person1_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "relationships_person2_id_fkey";
            columns: ["person2_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          role: ProfileRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          role?: ProfileRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          role?: ProfileRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      can_edit_family: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      current_user_role: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      submit_family_change_proposal: {
        Args: {
          proposal_type: string;
          target_person_id?: string | null;
          target_relationship_id?: string | null;
          payload: Record<string, unknown>;
          reason?: string | null;
          source_note?: string | null;
        };
        Returns: Record<string, unknown>;
      };
      list_my_family_change_proposals: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>[];
      };
      cancel_my_family_change_proposal: {
        Args: { proposal_id: string };
        Returns: Record<string, unknown>;
      };
      resubmit_family_change_proposal: {
        Args: {
          proposal_id: string;
          new_payload: Record<string, unknown>;
          response_comment?: string | null;
        };
        Returns: Record<string, unknown>;
      };
      admin_list_family_change_proposals: {
        Args: {
          status_filter?: string | null;
          type_filter?: string | null;
          limit_count?: number;
          offset_count?: number;
        };
        Returns: Record<string, unknown>[];
      };
      admin_count_pending_proposals: {
        Args: Record<string, never>;
        Returns: number;
      };
      review_family_change_proposal: {
        Args: {
          proposal_id: string;
          action: string;
          admin_comment?: string | null;
          confirm_duplicates?: boolean;
        };
        Returns: Record<string, unknown>;
      };
      approve_photo_change_proposal: {
        Args: {
          proposal_id: string;
          official_photo_path: string;
          admin_comment?: string | null;
        };
        Returns: Record<string, unknown>;
      };
      admin_list_users: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>[];
      };
      admin_set_user_role: {
        Args: { target_user_id: string; new_role: string };
        Returns: Record<string, unknown>;
      };
      admin_list_audit_log: {
        Args: { limit_count?: number; offset_count?: number };
        Returns: Record<string, unknown>[];
      };
      list_proposal_messages: {
        Args: { proposal_id: string };
        Returns: Record<string, unknown>[];
      };
      create_relative: {
        Args: {
          reference_person_id: string;
          relation_kind: RelationKind;
          person_data: CreateRelativePersonData;
          second_parent_id?: string | null;
        };
        Returns: string;
      };
      update_person: {
        Args: {
          target_person_id: string;
          person_data: UpdatePersonInput;
        };
        Returns: Database["public"]["Tables"]["people"]["Row"];
      };
      delete_person: {
        Args: {
          target_person_id: string;
        };
        Returns: DeletePersonResult;
      };
      set_person_photo: {
        Args: {
          target_person_id: string;
          new_photo_path: string;
        };
        Returns: Record<string, unknown>;
      };
      clear_person_photo: {
        Args: {
          target_person_id: string;
        };
        Returns: Record<string, unknown>;
      };
      validate_family_import: {
        Args: {
          payload: Record<string, unknown>;
        };
        Returns: Record<string, unknown>;
      };
      import_family_batch: {
        Args: {
          payload: Record<string, unknown>;
        };
        Returns: Record<string, unknown>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type DbPerson = Database["public"]["Tables"]["people"]["Row"];
export type DbRelationship = Database["public"]["Tables"]["relationships"]["Row"];
export type DbProfile = Database["public"]["Tables"]["profiles"]["Row"];

export interface UpdatePersonResult {
  person: DbPerson;
}
