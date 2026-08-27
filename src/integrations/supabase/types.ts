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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
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
      profiles: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          id: string
          is_admin: boolean
          must_change_password: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name?: string
          id: string
          is_admin?: boolean
          must_change_password?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          id?: string
          is_admin?: boolean
          must_change_password?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_active_admin: { Args: { _user_id: string }; Returns: boolean }
      new_inbound_email_token: { Args: never; Returns: string }
    }
    Enums: {
      event_status: "idea" | "provisional" | "confirmed" | "cancelled"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
    },
  },
} as const
