export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      backup_runs: {
        Row: {
          backup_type: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          event_count: number | null
          external_backup_at: string | null
          external_backup_error: string | null
          external_backup_status: string
          file_size: number | null
          id: string
          started_at: string
          status: string
          storage_path: string | null
        }
        Insert: {
          backup_type: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          event_count?: number | null
          external_backup_at?: string | null
          external_backup_error?: string | null
          external_backup_status?: string
          file_size?: number | null
          id?: string
          started_at?: string
          status?: string
          storage_path?: string | null
        }
        Update: {
          backup_type?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          event_count?: number | null
          external_backup_at?: string | null
          external_backup_error?: string | null
          external_backup_status?: string
          file_size?: number | null
          id?: string
          started_at?: string
          status?: string
          storage_path?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          active: boolean
          color: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      event_attachments: {
        Row: {
          created_at: string
          event_email_id: string | null
          event_id: string
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          source: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          event_email_id?: string | null
          event_id: string
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          source?: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          event_email_id?: string | null
          event_id?: string
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          source?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_attachments_event_email_id_fkey"
            columns: ["event_email_id"]
            isOneToOne: false
            referencedRelation: "event_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attachments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_emails: {
        Row: {
          created_at: string
          event_id: string
          from_address: string
          from_name: string | null
          html_body: string | null
          id: string
          message_id: string | null
          received_at: string
          resend_email_id: string
          subject: string | null
          text_body: string | null
          to_address: string
        }
        Insert: {
          created_at?: string
          event_id: string
          from_address: string
          from_name?: string | null
          html_body?: string | null
          id?: string
          message_id?: string | null
          received_at?: string
          resend_email_id: string
          subject?: string | null
          text_body?: string | null
          to_address: string
        }
        Update: {
          created_at?: string
          event_id?: string
          from_address?: string
          from_name?: string | null
          html_body?: string | null
          id?: string
          message_id?: string | null
          received_at?: string
          resend_email_id?: string
          subject?: string | null
          text_body?: string | null
          to_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_emails_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_planning_areas: {
        Row: {
          created_at: string
          event_id: string
          id: string
          planning_area_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          planning_area_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          planning_area_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_planning_areas_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_planning_areas_planning_area_id_fkey"
            columns: ["planning_area_id"]
            isOneToOne: false
            referencedRelation: "planning_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          all_day: boolean
          category_id: string
          created_at: string
          created_by: string | null
          deposit_amount: number | null
          deposit_received: boolean
          deposit_received_at: string | null
          end_date: string | null
          end_time: string | null
          external_id: string | null
          external_source: string | null
          id: string
          inbound_email_token: string
          last_synced_at: string | null
          migration_review_required: boolean
          migration_source: string | null
          migration_source_ref: string | null
          notes: string | null
          offline_sync_id: string | null
          pax: number | null
          responsible_user_id: string | null
          start_date: string
          start_time: string | null
          status: Database["public"]["Enums"]["event_status"]
          sync_status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          category_id: string
          created_at?: string
          created_by?: string | null
          deposit_amount?: number | null
          deposit_received?: boolean
          deposit_received_at?: string | null
          end_date?: string | null
          end_time?: string | null
          external_id?: string | null
          external_source?: string | null
          id?: string
          inbound_email_token?: string
          last_synced_at?: string | null
          migration_review_required?: boolean
          migration_source?: string | null
          migration_source_ref?: string | null
          notes?: string | null
          offline_sync_id?: string | null
          pax?: number | null
          responsible_user_id?: string | null
          start_date: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          sync_status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          category_id?: string
          created_at?: string
          created_by?: string | null
          deposit_amount?: number | null
          deposit_received?: boolean
          deposit_received_at?: string | null
          end_date?: string | null
          end_time?: string | null
          external_id?: string | null
          external_source?: string | null
          id?: string
          inbound_email_token?: string
          last_synced_at?: string | null
          migration_review_required?: boolean
          migration_source?: string | null
          migration_source_ref?: string | null
          notes?: string | null
          offline_sync_id?: string | null
          pax?: number | null
          responsible_user_id?: string | null
          start_date?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          sync_status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_email_log: {
        Row: {
          detail: string | null
          event_id: string | null
          from_address: string | null
          id: string
          outcome: string
          received_at: string
          recipients: string | null
          resend_email_id: string | null
          subject: string | null
        }
        Insert: {
          detail?: string | null
          event_id?: string | null
          from_address?: string | null
          id?: string
          outcome: string
          received_at?: string
          recipients?: string | null
          resend_email_id?: string | null
          subject?: string | null
        }
        Update: {
          detail?: string | null
          event_id?: string | null
          from_address?: string | null
          id?: string
          outcome?: string
          received_at?: string
          recipients?: string | null
          resend_email_id?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbound_email_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_areas: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profile_planning_area_permissions: {
        Row: {
          can_delete: boolean
          created_at: string
          id: string
          planning_area_id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          can_delete?: boolean
          created_at?: string
          id?: string
          planning_area_id: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          can_delete?: boolean
          created_at?: string
          id?: string
          planning_area_id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_planning_area_permissions_planning_area_id_fkey"
            columns: ["planning_area_id"]
            isOneToOne: false
            referencedRelation: "planning_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_planning_area_permissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          id: string
          is_admin: boolean | null
          must_change_password: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name?: string
          id: string
          is_admin?: boolean | null
          must_change_password?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          id?: string
          is_admin?: boolean | null
          must_change_password?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      radar_events: {
        Row: {
          active: boolean
          all_day: boolean
          canton: string | null
          category: string | null
          city: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          end_time: string | null
          external_id: string | null
          id: string
          is_manual: boolean
          kundivent_idea: string | null
          last_synced_at: string | null
          location_name: string | null
          relevance: string
          source_id: string
          source_key: string
          source_url: string | null
          start_date: string
          start_time: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          all_day?: boolean
          canton?: string | null
          category?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          external_id?: string | null
          id?: string
          is_manual?: boolean
          kundivent_idea?: string | null
          last_synced_at?: string | null
          location_name?: string | null
          relevance?: string
          source_id: string
          source_key: string
          source_url?: string | null
          start_date: string
          start_time?: string | null
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          all_day?: boolean
          canton?: string | null
          category?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          external_id?: string | null
          id?: string
          is_manual?: boolean
          kundivent_idea?: string | null
          last_synced_at?: string | null
          location_name?: string | null
          relevance?: string
          source_id?: string
          source_key?: string
          source_url?: string | null
          start_date?: string
          start_time?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "radar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radar_events_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "radar_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      radar_sources: {
        Row: {
          active: boolean
          base_url: string | null
          created_at: string
          id: string
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_status: string | null
          last_sync_summary: string | null
          name: string
          source_type: string
          sync_enabled: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_url?: string | null
          created_at?: string
          id: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_sync_summary?: string | null
          name: string
          source_type: string
          sync_enabled?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_url?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_sync_summary?: string | null
          name?: string
          source_type?: string
          sync_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      radar_theme_days: {
        Row: {
          active: boolean
          category: string
          created_at: string
          day: number
          description: string | null
          id: string
          kundivent_idea: string | null
          month: number
          name: string
          relevance: string
          source_url: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          day: number
          description?: string | null
          id?: string
          kundivent_idea?: string | null
          month: number
          name: string
          relevance?: string
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          day?: number
          description?: string | null
          id?: string
          kundivent_idea?: string | null
          month?: number
          name?: string
          relevance?: string
          source_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_delete_event: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_active_admin: { Args: { _user_id: string }; Returns: boolean }
      is_active_editor_or_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
      new_inbound_email_token: { Args: never; Returns: string }
      verify_backup_token: { Args: { _token: string }; Returns: boolean }
    }
    Enums: {
      event_status: "idea" | "provisional" | "confirmed" | "cancelled"
      user_role: "viewer" | "editor" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      event_status: ["idea", "provisional", "confirmed", "cancelled"],
      user_role: ["viewer", "editor", "admin"],
    },
  },
} as const
