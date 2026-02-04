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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          new_value: Json | null
          old_value: Json | null
          target_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
          token_hash: string | null
          token_prefix: string | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
          token_hash?: string | null
          token_prefix?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
          token_hash?: string | null
          token_prefix?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      ai_models: {
        Row: {
          access_level: Database["public"]["Enums"]["model_access_level"]
          api_endpoint: string | null
          api_key_encrypted: string | null
          category: string
          cooldown_until: string | null
          created_at: string
          created_by: string | null
          credits_cost: number
          description: string | null
          engine_type: string
          fallback_model_id: string | null
          id: string
          is_partner_only: boolean
          is_soft_disabled: boolean
          model_id: string
          name: string
          provider_id: string | null
          rpd: number
          rpm: number
          soft_disable_message: string | null
          status: Database["public"]["Enums"]["model_status"]
          updated_at: string
          usage_count: number
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["model_access_level"]
          api_endpoint?: string | null
          api_key_encrypted?: string | null
          category: string
          cooldown_until?: string | null
          created_at?: string
          created_by?: string | null
          credits_cost?: number
          description?: string | null
          engine_type: string
          fallback_model_id?: string | null
          id?: string
          is_partner_only?: boolean
          is_soft_disabled?: boolean
          model_id: string
          name: string
          provider_id?: string | null
          rpd?: number
          rpm?: number
          soft_disable_message?: string | null
          status?: Database["public"]["Enums"]["model_status"]
          updated_at?: string
          usage_count?: number
        }
        Update: {
          access_level?: Database["public"]["Enums"]["model_access_level"]
          api_endpoint?: string | null
          api_key_encrypted?: string | null
          category?: string
          cooldown_until?: string | null
          created_at?: string
          created_by?: string | null
          credits_cost?: number
          description?: string | null
          engine_type?: string
          fallback_model_id?: string | null
          id?: string
          is_partner_only?: boolean
          is_soft_disabled?: boolean
          model_id?: string
          name?: string
          provider_id?: string | null
          rpd?: number
          rpm?: number
          soft_disable_message?: string | null
          status?: Database["public"]["Enums"]["model_status"]
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_models_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_cache: {
        Row: {
          cache_key: string
          computed_at: string
          created_at: string
          data: Json
          expires_at: string
          id: string
        }
        Insert: {
          cache_key: string
          computed_at?: string
          created_at?: string
          data: Json
          expires_at?: string
          id?: string
        }
        Update: {
          cache_key?: string
          computed_at?: string
          created_at?: string
          data?: Json
          expires_at?: string
          id?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          message: string
          starts_at: string | null
          target_roles: Database["public"]["Enums"]["app_role"][] | null
          title: string
          type: Database["public"]["Enums"]["announcement_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          message: string
          starts_at?: string | null
          target_roles?: Database["public"]["Enums"]["app_role"][] | null
          title: string
          type?: Database["public"]["Enums"]["announcement_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          message?: string
          starts_at?: string | null
          target_roles?: Database["public"]["Enums"]["app_role"][] | null
          title?: string
          type?: Database["public"]["Enums"]["announcement_type"]
          updated_at?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          allowed_models: string[] | null
          created_at: string
          custom_rpd: number | null
          custom_rpm: number | null
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          last_used_ip: string | null
          name: string
          status: Database["public"]["Enums"]["api_key_status"]
          usage_count: number
          user_id: string
        }
        Insert: {
          allowed_models?: string[] | null
          created_at?: string
          custom_rpd?: number | null
          custom_rpm?: number | null
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          last_used_ip?: string | null
          name: string
          status?: Database["public"]["Enums"]["api_key_status"]
          usage_count?: number
          user_id: string
        }
        Update: {
          allowed_models?: string[] | null
          created_at?: string
          custom_rpd?: number | null
          custom_rpm?: number | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          last_used_ip?: string | null
          name?: string
          status?: Database["public"]["Enums"]["api_key_status"]
          usage_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      credits_transactions: {
        Row: {
          admin_id: string | null
          amount: number
          created_at: string
          id: string
          reason: string | null
          related_image_id: string | null
          type: Database["public"]["Enums"]["credit_transaction_type"]
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          amount: number
          created_at?: string
          id?: string
          reason?: string | null
          related_image_id?: string | null
          type: Database["public"]["Enums"]["credit_transaction_type"]
          user_id: string
        }
        Update: {
          admin_id?: string | null
          amount?: number
          created_at?: string
          id?: string
          reason?: string | null
          related_image_id?: string | null
          type?: Database["public"]["Enums"]["credit_transaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credits_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          config: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_enabled: boolean
          name: string
          rollout_percentage: number | null
          target_account_types:
            | Database["public"]["Enums"]["account_type"][]
            | null
          target_roles: Database["public"]["Enums"]["app_role"][] | null
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean
          name: string
          rollout_percentage?: number | null
          target_account_types?:
            | Database["public"]["Enums"]["account_type"][]
            | null
          target_roles?: Database["public"]["Enums"]["app_role"][] | null
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean
          name?: string
          rollout_percentage?: number | null
          target_account_types?:
            | Database["public"]["Enums"]["account_type"][]
            | null
          target_roles?: Database["public"]["Enums"]["app_role"][] | null
          updated_at?: string
        }
        Relationships: []
      }
      images: {
        Row: {
          api_key_id: string | null
          created_at: string
          credits_used: number
          error: string | null
          generation_time_ms: number | null
          height: number | null
          id: string
          image_url: string | null
          metadata: Json | null
          model_id: string | null
          negative_prompt: string | null
          prompt: string
          provider_id: string | null
          status: Database["public"]["Enums"]["image_status"]
          thumbnail_url: string | null
          user_id: string
          width: number | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          credits_used?: number
          error?: string | null
          generation_time_ms?: number | null
          height?: number | null
          id?: string
          image_url?: string | null
          metadata?: Json | null
          model_id?: string | null
          negative_prompt?: string | null
          prompt: string
          provider_id?: string | null
          status?: Database["public"]["Enums"]["image_status"]
          thumbnail_url?: string | null
          user_id: string
          width?: number | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          credits_used?: number
          error?: string | null
          generation_time_ms?: number | null
          height?: number | null
          id?: string
          image_url?: string | null
          metadata?: Json | null
          model_id?: string | null
          negative_prompt?: string | null
          prompt?: string
          provider_id?: string | null
          status?: Database["public"]["Enums"]["image_status"]
          thumbnail_url?: string | null
          user_id?: string
          width?: number | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string
          file_name: string | null
          file_url: string | null
          id: string
          invoice_number: string
          paid_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          invoice_number: string
          paid_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          invoice_number?: string
          paid_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ip_blocklist: {
        Row: {
          blocked_by: string | null
          cidr_range: string | null
          created_at: string
          expires_at: string | null
          id: string
          ip_address: string
          notes: string | null
          reason: Database["public"]["Enums"]["block_reason"]
        }
        Insert: {
          blocked_by?: string | null
          cidr_range?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          ip_address: string
          notes?: string | null
          reason?: Database["public"]["Enums"]["block_reason"]
        }
        Update: {
          blocked_by?: string | null
          cidr_range?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          ip_address?: string
          notes?: string | null
          reason?: Database["public"]["Enums"]["block_reason"]
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          attachment_name: string | null
          attachment_url: string | null
          created_at: string
          id: string
          message: string
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          action_url?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          created_at?: string
          id?: string
          message: string
          read_at?: string | null
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          action_url?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          created_at?: string
          id?: string
          message?: string
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          avatar_url: string | null
          ban_reason: string | null
          banned_at: string | null
          banned_by: string | null
          created_at: string
          custom_rpd: number | null
          custom_rpm: number | null
          display_name: string | null
          email: string | null
          force_password_reset: boolean
          id: string
          is_banned: boolean
          last_login_at: string | null
          last_login_ip: string | null
          max_images_per_day: number | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          banned_by?: string | null
          created_at?: string
          custom_rpd?: number | null
          custom_rpm?: number | null
          display_name?: string | null
          email?: string | null
          force_password_reset?: boolean
          id?: string
          is_banned?: boolean
          last_login_at?: string | null
          last_login_ip?: string | null
          max_images_per_day?: number | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          banned_by?: string | null
          created_at?: string
          custom_rpd?: number | null
          custom_rpm?: number | null
          display_name?: string | null
          email?: string | null
          force_password_reset?: boolean
          id?: string
          is_banned?: boolean
          last_login_at?: string | null
          last_login_ip?: string | null
          max_images_per_day?: number | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      providers: {
        Row: {
          api_key_encrypted: string | null
          base_url: string | null
          config: Json | null
          cost_per_image: number
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          is_fallback: boolean
          key_encrypted_at: string | null
          last_test_at: string | null
          last_test_message: string | null
          last_test_response_time: number | null
          last_test_status: string | null
          name: string
          priority: number
          status: Database["public"]["Enums"]["provider_status"]
          status_page_url: string | null
          updated_at: string
        }
        Insert: {
          api_key_encrypted?: string | null
          base_url?: string | null
          config?: Json | null
          cost_per_image?: number
          created_at?: string
          created_by?: string | null
          display_name: string
          id?: string
          is_fallback?: boolean
          key_encrypted_at?: string | null
          last_test_at?: string | null
          last_test_message?: string | null
          last_test_response_time?: number | null
          last_test_status?: string | null
          name: string
          priority?: number
          status?: Database["public"]["Enums"]["provider_status"]
          status_page_url?: string | null
          updated_at?: string
        }
        Update: {
          api_key_encrypted?: string | null
          base_url?: string | null
          config?: Json | null
          cost_per_image?: number
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          is_fallback?: boolean
          key_encrypted_at?: string | null
          last_test_at?: string | null
          last_test_message?: string | null
          last_test_response_time?: number | null
          last_test_status?: string | null
          name?: string
          priority?: number
          status?: Database["public"]["Enums"]["provider_status"]
          status_page_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      request_logs: {
        Row: {
          api_key_id: string | null
          country: string | null
          created_at: string
          endpoint: string
          error_message: string | null
          id: string
          image_id: string | null
          ip_address: string | null
          method: string
          request_body: Json | null
          response_time_ms: number | null
          status_code: number | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          api_key_id?: string | null
          country?: string | null
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: string
          image_id?: string | null
          ip_address?: string | null
          method: string
          request_body?: Json | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          api_key_id?: string | null
          country?: string | null
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: string
          image_id?: string | null
          ip_address?: string | null
          method?: string
          request_body?: Json | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      security_events: {
        Row: {
          api_key_id: string | null
          created_at: string
          details: Json | null
          event_type: Database["public"]["Enums"]["security_event_type"]
          id: string
          ip_address: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          details?: Json | null
          event_type: Database["public"]["Enums"]["security_event_type"]
          id?: string
          ip_address?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          details?: Json | null
          event_type?: Database["public"]["Enums"]["security_event_type"]
          id?: string
          ip_address?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          balance: number
          created_at: string
          daily_credits: number
          id: string
          last_daily_reset: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          daily_credits?: number
          id?: string
          last_daily_reset?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          daily_credits?: number
          id?: string
          last_daily_reset?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_owner: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_owner?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_owner?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      announcements_public: {
        Row: {
          created_at: string | null
          ends_at: string | null
          id: string | null
          is_active: boolean | null
          message: string | null
          starts_at: string | null
          title: string | null
          type: Database["public"]["Enums"]["announcement_type"] | null
        }
        Insert: {
          created_at?: string | null
          ends_at?: string | null
          id?: string | null
          is_active?: boolean | null
          message?: string | null
          starts_at?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["announcement_type"] | null
        }
        Update: {
          created_at?: string | null
          ends_at?: string | null
          id?: string | null
          is_active?: boolean | null
          message?: string | null
          starts_at?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["announcement_type"] | null
        }
        Relationships: []
      }
      feature_flags_public: {
        Row: {
          description: string | null
          id: string | null
          is_enabled: boolean | null
          name: string | null
        }
        Insert: {
          description?: string | null
          id?: string | null
          is_enabled?: boolean | null
          name?: string | null
        }
        Update: {
          description?: string | null
          id?: string | null
          is_enabled?: boolean | null
          name?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      assign_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _target_user_id: string
        }
        Returns: Json
      }
      bootstrap_owner: {
        Args: { _bootstrap_key: string; _user_id: string }
        Returns: Json
      }
      create_admin_invite: {
        Args: {
          _expires_in_days?: number
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: Json
      }
      generate_invite_token: { Args: never; Returns: string }
      get_account_type: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["account_type"]
      }
      get_model_analytics: {
        Args: { p_end_date: string; p_model_id: string; p_start_date: string }
        Returns: {
          avg_response_time: number
          date: string
          failed_requests: number
          successful_requests: number
          total_credits: number
          total_requests: number
        }[]
      }
      get_model_summary_stats: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          avg_credits_per_gen: number
          avg_response_time: number
          failed_requests: number
          last_used: string
          model_id: string
          model_name: string
          success_rate: number
          successful_requests: number
          total_credits: number
          total_requests: number
        }[]
      }
      get_model_top_users: {
        Args: {
          p_end_date: string
          p_limit?: number
          p_model_id: string
          p_start_date: string
        }
        Returns: {
          credits_spent: number
          last_used: string
          success_rate: number
          total_generations: number
          user_email: string
          user_id: string
        }[]
      }
      get_orphaned_user_count: { Args: never; Returns: number }
      get_provider_analytics: {
        Args: {
          p_end_date: string
          p_provider_id: string
          p_start_date: string
        }
        Returns: {
          avg_response_time: number
          date: string
          failed_requests: number
          successful_requests: number
          total_requests: number
        }[]
      }
      get_provider_models: {
        Args: {
          p_end_date: string
          p_provider_id: string
          p_start_date: string
        }
        Returns: {
          avg_response_time: number
          model_id: string
          model_name: string
          success_rate: number
          total_requests: number
        }[]
      }
      get_provider_summary_stats: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          avg_response_time: number
          failed_requests: number
          last_used: string
          provider_display_name: string
          provider_id: string
          provider_name: string
          success_rate: number
          successful_requests: number
          total_cost: number
          total_requests: number
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_invite_token: { Args: { token: string }; Returns: string }
      is_admin_or_above: { Args: { _user_id: string }; Returns: boolean }
      is_moderator_or_above: { Args: { _user_id: string }; Returns: boolean }
      is_owner: { Args: { _user_id: string }; Returns: boolean }
      is_system_bootstrapped: { Args: never; Returns: boolean }
      log_admin_action: {
        Args: {
          _action: string
          _details?: Json
          _new_value?: Json
          _old_value?: Json
          _target_id?: string
          _target_type?: string
        }
        Returns: string
      }
      log_profile_fallback_event: {
        Args: { _action: string; _details?: Json; _target_id: string }
        Returns: undefined
      }
      redeem_admin_invite: { Args: { _token: string }; Returns: Json }
      sync_missing_profiles: { Args: never; Returns: number }
      sync_missing_profiles_system: { Args: never; Returns: number }
      update_account_type: {
        Args: {
          _account_type: Database["public"]["Enums"]["account_type"]
          _target_user_id: string
        }
        Returns: Json
      }
      validate_invite_token: { Args: { _token: string }; Returns: Json }
    }
    Enums: {
      account_type: "normal" | "partner"
      announcement_type:
        | "info"
        | "warning"
        | "error"
        | "success"
        | "maintenance"
      api_key_status:
        | "active"
        | "suspended"
        | "expired"
        | "revoked"
        | "rate_limited"
      app_role:
        | "super_admin"
        | "admin"
        | "moderator"
        | "user"
        | "support"
        | "analyst"
      block_reason:
        | "abuse"
        | "spam"
        | "ddos"
        | "vpn"
        | "proxy"
        | "manual"
        | "country"
      credit_transaction_type:
        | "add"
        | "deduct"
        | "refund"
        | "expire"
        | "daily_reset"
        | "generation"
      image_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      model_access_level: "public" | "partner_only" | "admin_only"
      model_status: "active" | "beta" | "disabled" | "offline"
      notification_type:
        | "info"
        | "warning"
        | "error"
        | "success"
        | "credit"
        | "security"
        | "system"
      provider_status: "active" | "inactive" | "maintenance" | "error"
      security_event_type:
        | "login_failed"
        | "rate_limit"
        | "suspicious_activity"
        | "api_abuse"
        | "blocked_ip"
        | "auto_ban"
        | "prompt_filter"
        | "vpn_detected"
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
      account_type: ["normal", "partner"],
      announcement_type: ["info", "warning", "error", "success", "maintenance"],
      api_key_status: [
        "active",
        "suspended",
        "expired",
        "revoked",
        "rate_limited",
      ],
      app_role: [
        "super_admin",
        "admin",
        "moderator",
        "user",
        "support",
        "analyst",
      ],
      block_reason: [
        "abuse",
        "spam",
        "ddos",
        "vpn",
        "proxy",
        "manual",
        "country",
      ],
      credit_transaction_type: [
        "add",
        "deduct",
        "refund",
        "expire",
        "daily_reset",
        "generation",
      ],
      image_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
      model_access_level: ["public", "partner_only", "admin_only"],
      model_status: ["active", "beta", "disabled", "offline"],
      notification_type: [
        "info",
        "warning",
        "error",
        "success",
        "credit",
        "security",
        "system",
      ],
      provider_status: ["active", "inactive", "maintenance", "error"],
      security_event_type: [
        "login_failed",
        "rate_limit",
        "suspicious_activity",
        "api_abuse",
        "blocked_ip",
        "auto_ban",
        "prompt_filter",
        "vpn_detected",
      ],
    },
  },
} as const
