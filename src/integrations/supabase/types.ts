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
      achievements: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      app_releases: {
        Row: {
          changelog: string | null
          created_at: string
          created_by: string | null
          file_path: string
          file_size: number | null
          id: string
          is_active: boolean
          notes: string | null
          platform: string
          version: string
        }
        Insert: {
          changelog?: string | null
          created_at?: string
          created_by?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          is_active?: boolean
          notes?: string | null
          platform: string
          version: string
        }
        Update: {
          changelog?: string | null
          created_at?: string
          created_by?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          is_active?: boolean
          notes?: string | null
          platform?: string
          version?: string
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          created_at: string
          id: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      call_sessions: {
        Row: {
          call_id: string
          callee_id: string
          caller_id: string
          created_at: string
          id: string
        }
        Insert: {
          call_id: string
          callee_id: string
          caller_id: string
          created_at?: string
          id?: string
        }
        Update: {
          call_id?: string
          callee_id?: string
          caller_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          display_order: number
          icon: string | null
          id: string
          is_active: boolean
          is_popular: boolean
          name: string
          slug: string | null
          thread_count: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          is_popular?: boolean
          name: string
          slug?: string | null
          thread_count?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          is_popular?: boolean
          name?: string
          slug?: string | null
          thread_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      conversation_states: {
        Row: {
          archived_at: string | null
          conversation_id: string
          muted_until: string | null
          pinned_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          conversation_id: string
          muted_until?: string | null
          pinned_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          conversation_id?: string
          muted_until?: string | null
          pinned_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_states_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: []
      }
      device_push_tokens: {
        Row: {
          created_at: string
          device_label: string | null
          id: string
          last_seen_at: string
          notify_updates: boolean
          platform: string
          token: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_label?: string | null
          id?: string
          last_seen_at?: string
          notify_updates?: boolean
          platform: string
          token: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_label?: string | null
          id?: string
          last_seen_at?: string
          notify_updates?: boolean
          platform?: string
          token?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      donation_accounts: {
        Row: {
          account_name: string
          account_number: string | null
          account_type: string
          bank_name: string | null
          created_at: string
          crypto_currency: string | null
          crypto_network: string | null
          description: string | null
          id: string
          is_active: boolean
          order_index: number
          updated_at: string
          wallet_address: string | null
        }
        Insert: {
          account_name: string
          account_number?: string | null
          account_type: string
          bank_name?: string | null
          created_at?: string
          crypto_currency?: string | null
          crypto_network?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          order_index?: number
          updated_at?: string
          wallet_address?: string | null
        }
        Update: {
          account_name?: string
          account_number?: string | null
          account_type?: string
          bank_name?: string | null
          created_at?: string
          crypto_currency?: string | null
          crypto_network?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          order_index?: number
          updated_at?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      hero_slides: {
        Row: {
          badge_text: string | null
          bg_color_from: string | null
          bg_color_to: string | null
          body: string | null
          created_at: string
          created_by: string | null
          cta_label: string | null
          cta_label_2: string | null
          cta_url: string | null
          cta_url_2: string | null
          expires_at: string | null
          id: string
          image_url: string | null
          is_active: boolean
          order: number
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          badge_text?: string | null
          bg_color_from?: string | null
          bg_color_to?: string | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_label_2?: string | null
          cta_url?: string | null
          cta_url_2?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          order?: number
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          badge_text?: string | null
          bg_color_from?: string | null
          bg_color_to?: string | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_label_2?: string | null
          cta_url?: string | null
          cta_url_2?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          order?: number
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hero_slides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hero_slides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_reports: {
        Row: {
          contact_email: string | null
          created_at: string
          description: string
          id: string
          page_url: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          description: string
          id?: string
          page_url?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          description?: string
          id?: string
          page_url?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_expires_at: string | null
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          attachment_type: string | null
          attachment_url: string | null
          content: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          deleted_for_everyone: boolean
          edited_at: string | null
          forwarded_from_id: string | null
          id: string
          is_read: boolean
          read_at: string | null
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          attachment_expires_at?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_for_everyone?: boolean
          edited_at?: string | null
          forwarded_from_id?: string | null
          id?: string
          is_read?: boolean
          read_at?: string | null
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          attachment_expires_at?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_for_everyone?: boolean
          edited_at?: string | null
          forwarded_from_id?: string | null
          id?: string
          is_read?: boolean
          read_at?: string | null
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_forwarded_from_id_fkey"
            columns: ["forwarded_from_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_appeals: {
        Row: {
          categories: string[] | null
          created_at: string
          id: string
          original_content: string
          original_title: string | null
          reason_shown: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          surface: string
          updated_at: string
          user_id: string
          user_note: string
        }
        Insert: {
          categories?: string[] | null
          created_at?: string
          id?: string
          original_content: string
          original_title?: string | null
          reason_shown?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          surface: string
          updated_at?: string
          user_id: string
          user_note: string
        }
        Update: {
          categories?: string[] | null
          created_at?: string
          id?: string
          original_content?: string
          original_title?: string | null
          reason_shown?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          surface?: string
          updated_at?: string
          user_id?: string
          user_note?: string
        }
        Relationships: []
      }
      moderation_log: {
        Row: {
          allowed: boolean
          categories: string[]
          content_excerpt: string | null
          created_at: string
          degraded: boolean
          id: string
          overridden: boolean
          reason: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          surface: string
          title: string | null
          user_id: string | null
        }
        Insert: {
          allowed: boolean
          categories?: string[]
          content_excerpt?: string | null
          created_at?: string
          degraded?: boolean
          id?: string
          overridden?: boolean
          reason?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          surface?: string
          title?: string | null
          user_id?: string | null
        }
        Update: {
          allowed?: boolean
          categories?: string[]
          content_excerpt?: string | null
          created_at?: string
          degraded?: boolean
          id?: string
          overridden?: boolean
          reason?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          surface?: string
          title?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      password_reset_audit: {
        Row: {
          created_at: string
          email_hash: string | null
          event: string
          id: string
          ip: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email_hash?: string | null
          event: string
          id?: string
          ip?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email_hash?: string | null
          event?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      poll_options: {
        Row: {
          created_at: string
          id: string
          poll_id: string
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          poll_id: string
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          poll_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          poll_id: string
          poll_option_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          poll_id: string
          poll_option_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          poll_id?: string
          poll_option_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_option_id_fkey"
            columns: ["poll_option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          question: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          question: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          call_ringtone_settings: Json | null
          calls_enabled: boolean
          created_at: string
          current_location: string | null
          display_name: string | null
          dob: string | null
          email: string | null
          id: string
          is_banned: boolean
          is_deleted: boolean
          lga: string | null
          marital_status: string | null
          native_app_installed_at: string | null
          native_app_platform: string | null
          native_app_version: string | null
          notification_mode: string
          occupation: string | null
          reputation: number
          role: string | null
          sex: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          call_ringtone_settings?: Json | null
          calls_enabled?: boolean
          created_at?: string
          current_location?: string | null
          display_name?: string | null
          dob?: string | null
          email?: string | null
          id: string
          is_banned?: boolean
          is_deleted?: boolean
          lga?: string | null
          marital_status?: string | null
          native_app_installed_at?: string | null
          native_app_platform?: string | null
          native_app_version?: string | null
          notification_mode?: string
          occupation?: string | null
          reputation?: number
          role?: string | null
          sex?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          call_ringtone_settings?: Json | null
          calls_enabled?: boolean
          created_at?: string
          current_location?: string | null
          display_name?: string | null
          dob?: string | null
          email?: string | null
          id?: string
          is_banned?: boolean
          is_deleted?: boolean
          lga?: string | null
          marital_status?: string | null
          native_app_installed_at?: string | null
          native_app_platform?: string | null
          native_app_version?: string | null
          notification_mode?: string
          occupation?: string | null
          reputation?: number
          role?: string | null
          sex?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      pwa_install_events: {
        Row: {
          created_at: string
          event: string
          id: string
          platform: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          platform?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          platform?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      relationship_blocks: {
        Row: {
          blocked_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          blocked_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          blocked_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      relationship_profiles: {
        Row: {
          about: string | null
          created_at: string
          current_location: string | null
          dob: string | null
          headline: string | null
          height_cm: number | null
          id: string
          interests: string[]
          is_active: boolean
          lga: string | null
          looking_for: string | null
          marital_status: string | null
          occupation: string | null
          photos: string[]
          sex: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          about?: string | null
          created_at?: string
          current_location?: string | null
          dob?: string | null
          headline?: string | null
          height_cm?: number | null
          id?: string
          interests?: string[]
          is_active?: boolean
          lga?: string | null
          looking_for?: string | null
          marital_status?: string | null
          occupation?: string | null
          photos?: string[]
          sex?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          about?: string | null
          created_at?: string
          current_location?: string | null
          dob?: string | null
          headline?: string | null
          height_cm?: number | null
          id?: string
          interests?: string[]
          is_active?: boolean
          lga?: string | null
          looking_for?: string | null
          marital_status?: string | null
          occupation?: string | null
          photos?: string[]
          sex?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      replies: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_reply_id: string | null
          thread_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_reply_id?: string | null
          thread_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_reply_id?: string | null
          thread_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "replies_parent_reply_id_fkey"
            columns: ["parent_reply_id"]
            isOneToOne: false
            referencedRelation: "replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replies_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      reply_votes: {
        Row: {
          created_at: string
          id: string
          reply_id: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          reply_id: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          reply_id?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "reply_votes_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "replies"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          reply_id: string | null
          reported_user_id: string | null
          reporter_id: string | null
          status: string
          thread_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          reply_id?: string | null
          reported_user_id?: string | null
          reporter_id?: string | null
          status?: string
          thread_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          reply_id?: string | null
          reported_user_id?: string | null
          reporter_id?: string | null
          status?: string
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      search_rate_limits: {
        Row: {
          count: number
          scope: string
          user_id: string
          window_start: string
        }
        Insert: {
          count?: number
          scope: string
          user_id: string
          window_start: string
        }
        Update: {
          count?: number
          scope?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json | null
        }
        Relationships: []
      }
      subgroup_invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          single_use: boolean
          subgroup_id: string
          token: string
          used: boolean
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          single_use?: boolean
          subgroup_id: string
          token?: string
          used?: boolean
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          single_use?: boolean
          subgroup_id?: string
          token?: string
          used?: boolean
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subgroup_invites_subgroup_id_fkey"
            columns: ["subgroup_id"]
            isOneToOne: false
            referencedRelation: "subgroups"
            referencedColumns: ["id"]
          },
        ]
      }
      subgroup_join_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          message: string | null
          status: string
          subgroup_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          message?: string | null
          status?: string
          subgroup_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          message?: string | null
          status?: string
          subgroup_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subgroup_join_requests_subgroup_id_fkey"
            columns: ["subgroup_id"]
            isOneToOne: false
            referencedRelation: "subgroups"
            referencedColumns: ["id"]
          },
        ]
      }
      subgroup_members: {
        Row: {
          created_at: string
          id: string
          subgroup_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          subgroup_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          subgroup_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subgroup_members_subgroup_id_fkey"
            columns: ["subgroup_id"]
            isOneToOne: false
            referencedRelation: "subgroups"
            referencedColumns: ["id"]
          },
        ]
      }
      subgroup_membership_audit: {
        Row: {
          action: string
          created_at: string
          id: string
          subgroup_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          subgroup_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          subgroup_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subgroup_membership_audit_subgroup_id_fkey"
            columns: ["subgroup_id"]
            isOneToOne: false
            referencedRelation: "subgroups"
            referencedColumns: ["id"]
          },
        ]
      }
      subgroups: {
        Row: {
          category: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_featured: boolean
          is_private: boolean
          name: string
          rules: string[]
          updated_at: string
        }
        Insert: {
          category?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          is_private?: boolean
          name: string
          rules?: string[]
          updated_at?: string
        }
        Update: {
          category?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          is_private?: boolean
          name?: string
          rules?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      thread_votes: {
        Row: {
          created_at: string
          id: string
          thread_id: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          thread_id: string
          user_id: string
          value?: number
        }
        Update: {
          created_at?: string
          id?: string
          thread_id?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "thread_votes_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          allow_replies: boolean
          author_id: string | null
          category_id: string | null
          content: string | null
          created_at: string
          id: string
          is_anonymous: boolean
          is_deleted: boolean
          is_pinned: boolean
          pinned_at: string | null
          private_author_id: string | null
          subgroup_id: string | null
          tags: string[] | null
          title: string
          updated_at: string
          upvotes: number
          user_id: string | null
          view_count: number
        }
        Insert: {
          allow_replies?: boolean
          author_id?: string | null
          category_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          is_anonymous?: boolean
          is_deleted?: boolean
          is_pinned?: boolean
          pinned_at?: string | null
          private_author_id?: string | null
          subgroup_id?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          upvotes?: number
          user_id?: string | null
          view_count?: number
        }
        Update: {
          allow_replies?: boolean
          author_id?: string | null
          category_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          is_anonymous?: boolean
          is_deleted?: boolean
          is_pinned?: boolean
          pinned_at?: string | null
          private_author_id?: string | null
          subgroup_id?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          upvotes?: number
          user_id?: string | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "threads_author_id_profiles_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_author_id_profiles_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_subgroup_id_fkey"
            columns: ["subgroup_id"]
            isOneToOne: false
            referencedRelation: "subgroups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_known_devices: {
        Row: {
          fingerprint: string
          first_seen: string
          id: string
          last_seen: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          fingerprint: string
          first_seen?: string
          id?: string
          last_seen?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          fingerprint?: string
          first_seen?: string
          id?: string
          last_seen?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
          is_banned: boolean | null
          is_deleted: boolean | null
          lga: string | null
          reputation: number | null
          role: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          is_banned?: boolean | null
          is_deleted?: boolean | null
          lga?: string | null
          reputation?: number | null
          role?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          is_banned?: boolean | null
          is_deleted?: boolean | null
          lga?: string | null
          reputation?: number | null
          role?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_delete_user: { Args: { _user_id: string }; Returns: undefined }
      admin_get_user_emails: {
        Args: { _ids: string[] }
        Returns: {
          email: string
          id: string
        }[]
      }
      admin_list_users: {
        Args: {
          _ids?: string[]
          _limit?: number
          _offset?: number
          _search?: string
        }
        Returns: {
          avatar_url: string
          bio: string
          created_at: string
          display_name: string
          dob: string
          email: string
          id: string
          is_banned: boolean
          is_deleted: boolean
          lga: string
          reputation: number
          role: string
          total_count: number
          username: string
        }[]
      }
      admin_search_user_ids_by_email: {
        Args: { _term: string }
        Returns: {
          id: string
        }[]
      }
      clear_conversation: {
        Args: { _conversation_id: string }
        Returns: number
      }
      decide_join_request: {
        Args: { _approve: boolean; _request_id: string }
        Returns: undefined
      }
      delete_conversation: {
        Args: { _conversation_id: string }
        Returns: undefined
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_message_for_everyone: {
        Args: { _message_id: string }
        Returns: undefined
      }
      edit_message: {
        Args: { _message_id: string; _new_content: string }
        Returns: undefined
      }
      email_is_registered: { Args: { _email: string }; Returns: boolean }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enforce_rate_limit: {
        Args: { _max: number; _scope: string; _window_seconds?: number }
        Returns: undefined
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      forward_message: {
        Args: { _message_id: string; _to_conversation_id: string }
        Returns: string
      }
      get_my_profile: {
        Args: never
        Returns: {
          avatar_url: string | null
          bio: string | null
          call_ringtone_settings: Json | null
          calls_enabled: boolean
          created_at: string
          current_location: string | null
          display_name: string | null
          dob: string | null
          email: string | null
          id: string
          is_banned: boolean
          is_deleted: boolean
          lga: string | null
          marital_status: string | null
          native_app_installed_at: string | null
          native_app_platform: string | null
          native_app_version: string | null
          notification_mode: string
          occupation: string | null
          reputation: number
          role: string | null
          sex: string | null
          updated_at: string
          username: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_poll_counts: {
        Args: { _poll_ids: string[] }
        Returns: {
          poll_id: string
          poll_option_id: string
          vote_count: number
        }[]
      }
      get_public_profiles: {
        Args: { _ids: string[] }
        Returns: {
          avatar_url: string
          bio: string
          created_at: string
          display_name: string
          id: string
          is_banned: boolean
          is_deleted: boolean
          lga: string
          reputation: number
          role: string
          username: string
        }[]
      }
      get_reply_vote_counts: {
        Args: { _reply_ids: string[] }
        Returns: {
          downvotes: number
          reply_id: string
          upvotes: number
        }[]
      }
      get_thread_reply_counts: {
        Args: { _thread_ids: string[] }
        Returns: {
          reply_count: number
          thread_id: string
        }[]
      }
      get_thread_subgroup_id: { Args: { _thread_id: string }; Returns: string }
      get_thread_vote_counts: {
        Args: { _thread_ids: string[] }
        Returns: {
          downvotes: number
          thread_id: string
          upvotes: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_thread_view: {
        Args: { _thread_id: string }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_subgroup_admin: {
        Args: { _subgroup_id: string; _user_id: string }
        Returns: boolean
      }
      is_subgroup_member: {
        Args: { _subgroup_id: string; _user_id: string }
        Returns: boolean
      }
      mark_conversation_read: {
        Args: { _conversation_id: string }
        Returns: number
      }
      mark_message_read: { Args: { _message_id: string }; Returns: undefined }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      my_thread_ids: {
        Args: never
        Returns: {
          id: string
        }[]
      }
      pin_subgroup_thread: {
        Args: { _pinned: boolean; _thread_id: string }
        Returns: undefined
      }
      prune_issue_report_contact_emails: { Args: never; Returns: undefined }
      prune_search_rate_limits: { Args: never; Returns: undefined }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      redeem_subgroup_invite: { Args: { _token: string }; Returns: string }
      resolve_username_to_email: {
        Args: { _username: string }
        Returns: string
      }
      search_public_profiles: {
        Args: { _limit?: number; _term: string }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          username: string
        }[]
      }
      set_conversation_archived: {
        Args: { _archived: boolean; _conversation_id: string }
        Returns: undefined
      }
      set_conversation_pinned: {
        Args: { _conversation_id: string; _pinned: boolean }
        Returns: undefined
      }
      submit_moderation_appeal: {
        Args: {
          _categories: string[]
          _original_content: string
          _original_title: string
          _reason_shown: string
          _surface: string
          _user_note: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "Super Admin" | "Admin" | "Member"
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
      app_role: ["Super Admin", "Admin", "Member"],
    },
  },
} as const
