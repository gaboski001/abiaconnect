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
          file_sha256: string | null
          file_size: number | null
          id: string
          is_active: boolean
          notes: string | null
          platform: string
          uploaded_by: string | null
          uploaded_via: string | null
          version: string
        }
        Insert: {
          changelog?: string | null
          created_at?: string
          created_by?: string | null
          file_path: string
          file_sha256?: string | null
          file_size?: number | null
          id?: string
          is_active?: boolean
          notes?: string | null
          platform: string
          uploaded_by?: string | null
          uploaded_via?: string | null
          version: string
        }
        Update: {
          changelog?: string | null
          created_at?: string
          created_by?: string | null
          file_path?: string
          file_sha256?: string | null
          file_size?: number | null
          id?: string
          is_active?: boolean
          notes?: string | null
          platform?: string
          uploaded_by?: string | null
          uploaded_via?: string | null
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
      client_rate_limits: {
        Row: {
          client_key: string
          count: number
          scope: string
          window_start: string
        }
        Insert: {
          client_key: string
          count?: number
          scope: string
          window_start: string
        }
        Update: {
          client_key?: string
          count?: number
          scope?: string
          window_start?: string
        }
        Relationships: []
      }
      contest_ballots: {
        Row: {
          candidate_id: string
          contest_id: string
          id: string
        }
        Insert: {
          candidate_id: string
          contest_id: string
          id?: string
        }
        Update: {
          candidate_id?: string
          contest_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contest_ballots_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "contest_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contest_ballots_contest_id_fkey"
            columns: ["contest_id"]
            isOneToOne: false
            referencedRelation: "contests"
            referencedColumns: ["id"]
          },
        ]
      }
      contest_candidates: {
        Row: {
          bio: string | null
          contest_id: string
          id: string
          name: string
          photo_url: string | null
          position: number
        }
        Insert: {
          bio?: string | null
          contest_id: string
          id?: string
          name: string
          photo_url?: string | null
          position?: number
        }
        Update: {
          bio?: string | null
          contest_id?: string
          id?: string
          name?: string
          photo_url?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "contest_candidates_contest_id_fkey"
            columns: ["contest_id"]
            isOneToOne: false
            referencedRelation: "contests"
            referencedColumns: ["id"]
          },
        ]
      }
      contest_voter_codes: {
        Row: {
          code_hash: string
          contest_id: string
          created_at: string
          id: string
          used_at: string | null
        }
        Insert: {
          code_hash: string
          contest_id: string
          created_at?: string
          id?: string
          used_at?: string | null
        }
        Update: {
          code_hash?: string
          contest_id?: string
          created_at?: string
          id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contest_voter_codes_contest_id_fkey"
            columns: ["contest_id"]
            isOneToOne: false
            referencedRelation: "contests"
            referencedColumns: ["id"]
          },
        ]
      }
      contest_voters: {
        Row: {
          contest_id: string
          voter_key: string
        }
        Insert: {
          contest_id: string
          voter_key: string
        }
        Update: {
          contest_id?: string
          voter_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "contest_voters_contest_id_fkey"
            columns: ["contest_id"]
            isOneToOne: false
            referencedRelation: "contests"
            referencedColumns: ["id"]
          },
        ]
      }
      contests: {
        Row: {
          allow_code_voters: boolean
          allow_group_voters: boolean
          created_at: string
          created_by: string
          description: string | null
          ends_at: string
          id: string
          results_visibility: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          starts_at: string
          status: string
          subgroup_id: string | null
          title: string
        }
        Insert: {
          allow_code_voters?: boolean
          allow_group_voters?: boolean
          created_at?: string
          created_by: string
          description?: string | null
          ends_at: string
          id?: string
          results_visibility?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          starts_at: string
          status?: string
          subgroup_id?: string | null
          title: string
        }
        Update: {
          allow_code_voters?: boolean
          allow_group_voters?: boolean
          created_at?: string
          created_by?: string
          description?: string | null
          ends_at?: string
          id?: string
          results_visibility?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          starts_at?: string
          status?: string
          subgroup_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "contests_subgroup_id_fkey"
            columns: ["subgroup_id"]
            isOneToOne: false
            referencedRelation: "subgroups"
            referencedColumns: ["id"]
          },
        ]
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
      dating_likes: {
        Row: {
          created_at: string
          id: string
          kind: string
          liked_id: string
          liker_id: string
          seen_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          liked_id: string
          liker_id: string
          seen_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          liked_id?: string
          liker_id?: string
          seen_at?: string | null
        }
        Relationships: []
      }
      dating_matches: {
        Row: {
          created_at: string
          id: string
          user_high: string
          user_low: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_high: string
          user_low: string
        }
        Update: {
          created_at?: string
          id?: string
          user_high?: string
          user_low?: string
        }
        Relationships: []
      }
      dating_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
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
      donations: {
        Row: {
          admin_notes: string | null
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          currency: string
          donor_email: string | null
          donor_name: string
          id: string
          is_anonymous: boolean
          message: string | null
          payment_method: string
          reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          donor_email?: string | null
          donor_name: string
          id?: string
          is_anonymous?: boolean
          message?: string | null
          payment_method?: string
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          donor_email?: string | null
          donor_name?: string
          id?: string
          is_anonymous?: boolean
          message?: string | null
          payment_method?: string
          reference?: string | null
          status?: string
          updated_at?: string
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
      email_short_link_events: {
        Row: {
          created_at: string
          id: string
          ip_hint: string | null
          outcome: string
          purpose: string | null
          token: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_hint?: string | null
          outcome: string
          purpose?: string | null
          token: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_hint?: string | null
          outcome?: string
          purpose?: string | null
          token?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      email_short_links: {
        Row: {
          created_at: string
          expires_at: string
          purpose: string | null
          target_url: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          purpose?: string | null
          target_url: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          purpose?: string | null
          target_url?: string
          token?: string
          used_at?: string | null
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
      facebook_shares: {
        Row: {
          attempts: number
          created_at: string
          fb_post_id: string | null
          note: string | null
          posted_at: string | null
          requested_by: string | null
          source: string
          status: string
          thread_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          fb_post_id?: string | null
          note?: string | null
          posted_at?: string | null
          requested_by?: string | null
          source: string
          status?: string
          thread_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          fb_post_id?: string | null
          note?: string | null
          posted_at?: string | null
          requested_by?: string | null
          source?: string
          status?: string
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facebook_shares_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: true
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_usage: {
        Row: {
          count: number
          feature: string
          period_start: string
          user_id: string
        }
        Insert: {
          count?: number
          feature: string
          period_start: string
          user_id: string
        }
        Update: {
          count?: number
          feature?: string
          period_start?: string
          user_id?: string
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
          full_image: boolean
          id: string
          image_url: string | null
          is_active: boolean
          mobile_image_url: string | null
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
          full_image?: boolean
          id?: string
          image_url?: string | null
          is_active?: boolean
          mobile_image_url?: string | null
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
          full_image?: boolean
          id?: string
          image_url?: string | null
          is_active?: boolean
          mobile_image_url?: string | null
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
      member_badges: {
        Row: {
          awarded_at: string
          badge: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge?: string
          user_id?: string
        }
        Relationships: []
      }
      member_stats: {
        Row: {
          current_streak: number
          last_checkin: string | null
          longest_streak: number
          points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          last_checkin?: string | null
          longest_streak?: number
          points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          last_checkin?: string | null
          longest_streak?: number
          points?: number
          updated_at?: string
          user_id?: string
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
          actor: string
          allowed: boolean
          categories: string[]
          content_excerpt: string | null
          content_hash: string | null
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
          verdict: string | null
        }
        Insert: {
          actor?: string
          allowed: boolean
          categories?: string[]
          content_excerpt?: string | null
          content_hash?: string | null
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
          verdict?: string | null
        }
        Update: {
          actor?: string
          allowed?: boolean
          categories?: string[]
          content_excerpt?: string | null
          content_hash?: string | null
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
          verdict?: string | null
        }
        Relationships: []
      }
      moderation_queue: {
        Row: {
          attempts: number
          claimed_at: string | null
          created_at: string
          id: string
          kind: string
          outcome: string | null
          processed_at: string | null
          ref_id: string
          status: string
        }
        Insert: {
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          id?: string
          kind: string
          outcome?: string | null
          processed_at?: string | null
          ref_id: string
          status?: string
        }
        Update: {
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          outcome?: string | null
          processed_at?: string | null
          ref_id?: string
          status?: string
        }
        Relationships: []
      }
      monetization_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          new_value: Json | null
          old_value: Json | null
          target: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: number
          new_value?: Json | null
          old_value?: Json | null
          target?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: number
          new_value?: Json | null
          old_value?: Json | null
          target?: string | null
        }
        Relationships: []
      }
      monetization_events: {
        Row: {
          created_at: string
          event: string
          id: number
          metadata: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event: string
          id?: number
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          id?: number
          metadata?: Json
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
      payment_provider_logs: {
        Row: {
          action: string
          created_at: string
          duration_ms: number | null
          error: string | null
          http_status: number | null
          id: number
          ok: boolean
          provider: string
          reference: string | null
          request: Json | null
          response: Json | null
        }
        Insert: {
          action: string
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          http_status?: number | null
          id?: number
          ok?: boolean
          provider: string
          reference?: string | null
          request?: Json | null
          response?: Json | null
        }
        Update: {
          action?: string
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          http_status?: number | null
          id?: number
          ok?: boolean
          provider?: string
          reference?: string | null
          request?: Json | null
          response?: Json | null
        }
        Relationships: []
      }
      payment_providers: {
        Row: {
          contract_code: string | null
          display_name: string
          is_enabled: boolean
          mode: string
          provider: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          contract_code?: string | null
          display_name: string
          is_enabled?: boolean
          mode?: string
          provider: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          contract_code?: string | null
          display_name?: string
          is_enabled?: boolean
          mode?: string
          provider?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      payment_secret_settings: {
        Row: {
          mode: string
          name: string
          preview: string
          provider: string
          updated_at: string
          updated_by: string | null
          vault_id: string
        }
        Insert: {
          mode: string
          name: string
          preview: string
          provider: string
          updated_at?: string
          updated_by?: string | null
          vault_id: string
        }
        Update: {
          mode?: string
          name?: string
          preview?: string
          provider?: string
          updated_at?: string
          updated_by?: string | null
          vault_id?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount_minor: number
          checkout_url: string | null
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          mode: string
          plan_id: string | null
          provider: string
          provider_reference: string | null
          purpose: string
          reference: string
          refunded_at: string | null
          status: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          amount_minor: number
          checkout_url?: string | null
          created_at?: string
          currency: string
          failure_reason?: string | null
          id?: string
          mode?: string
          plan_id?: string | null
          provider: string
          provider_reference?: string | null
          purpose?: string
          reference: string
          refunded_at?: string | null
          status?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          amount_minor?: number
          checkout_url?: string | null
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          mode?: string
          plan_id?: string | null
          provider?: string
          provider_reference?: string | null
          purpose?: string
          reference?: string
          refunded_at?: string | null
          status?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          event_key: string
          event_type: string | null
          id: string
          payload: Json | null
          process_result: string | null
          processed_at: string | null
          provider: string
          received_at: string
          reference: string | null
          signature_valid: boolean
        }
        Insert: {
          event_key: string
          event_type?: string | null
          id?: string
          payload?: Json | null
          process_result?: string | null
          processed_at?: string | null
          provider: string
          received_at?: string
          reference?: string | null
          signature_valid: boolean
        }
        Update: {
          event_key?: string
          event_type?: string | null
          id?: string
          payload?: Json | null
          process_result?: string | null
          processed_at?: string | null
          provider?: string
          received_at?: string
          reference?: string | null
          signature_valid?: boolean
        }
        Relationships: []
      }
      points_ledger: {
        Row: {
          amount: number
          created_at: string
          day: string
          id: number
          reason: string
          ref_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          day?: string
          id?: never
          reason: string
          ref_id?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          day?: string
          id?: never
          reason?: string
          ref_id?: string
          user_id?: string
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
          message_privacy: string
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
          message_privacy?: string
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
          message_privacy?: string
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
          incognito: boolean
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
          incognito?: boolean
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
          incognito?: boolean
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
          is_hidden: boolean
          parent_reply_id: string | null
          thread_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_hidden?: boolean
          parent_reply_id?: string | null
          thread_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_hidden?: boolean
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
          ai_note: string | null
          ai_reviewed_at: string | null
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
          ai_note?: string | null
          ai_reviewed_at?: string | null
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
          ai_note?: string | null
          ai_reviewed_at?: string | null
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
      subscription_plans: {
        Row: {
          billing_period: string
          code: string
          created_at: string
          currency: string
          description: string | null
          duration_days: number
          features: Json
          id: string
          is_active: boolean
          is_recommended: boolean
          is_visible: boolean
          limits: Json
          name: string
          price_minor: number
          promo_price_minor: number | null
          sort_order: number
          tier: string
          updated_at: string
        }
        Insert: {
          billing_period?: string
          code: string
          created_at?: string
          currency?: string
          description?: string | null
          duration_days?: number
          features?: Json
          id?: string
          is_active?: boolean
          is_recommended?: boolean
          is_visible?: boolean
          limits?: Json
          name: string
          price_minor?: number
          promo_price_minor?: number | null
          sort_order?: number
          tier?: string
          updated_at?: string
        }
        Update: {
          billing_period?: string
          code?: string
          created_at?: string
          currency?: string
          description?: string | null
          duration_days?: number
          features?: Json
          id?: string
          is_active?: boolean
          is_recommended?: boolean
          is_visible?: boolean
          limits?: Json
          name?: string
          price_minor?: number
          promo_price_minor?: number | null
          sort_order?: number
          tier?: string
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
      user_subscriptions: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          note: string | null
          payment_id: string | null
          plan_id: string
          source: string
          starts_at: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          note?: string | null
          payment_id?: string | null
          plan_id: string
          source: string
          starts_at: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          note?: string | null
          payment_id?: string | null
          plan_id?: string
          source?: string
          starts_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          id: string
          idempotency_key: string
          metadata: Json
          payment_id: string | null
          reference_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          id?: string
          idempotency_key: string
          metadata?: Json
          payment_id?: string | null
          reference_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          payment_id?: string | null
          reference_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
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
      admin_birthday_coverage: { Args: never; Returns: Json }
      admin_birthdays_today: {
        Args: never
        Returns: {
          avatar_url: string
          display_name: string
          emailed: boolean
          greeted: boolean
          has_email: boolean
          turning: number
          user_id: string
          username: string
        }[]
      }
      admin_clear_payment_secret: {
        Args: { _name: string }
        Returns: undefined
      }
      admin_dating_setup_status: { Args: never; Returns: Json }
      admin_delete_user: { Args: { _user_id: string }; Returns: undefined }
      admin_find_members: {
        Args: { _q: string }
        Returns: {
          display_name: string
          dob: string
          user_id: string
          username: string
        }[]
      }
      admin_get_user_emails: {
        Args: { _ids: string[] }
        Returns: {
          email: string
          id: string
        }[]
      }
      admin_grant_subscription: {
        Args: {
          _days: number
          _note?: string
          _plan_code: string
          _user: string
        }
        Returns: string
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
      admin_monetization_summary: { Args: never; Returns: Json }
      admin_revoke_subscription: {
        Args: { _note?: string; _subscription_id: string }
        Returns: undefined
      }
      admin_search_user_ids_by_email: {
        Args: { _term: string }
        Returns: {
          id: string
        }[]
      }
      admin_set_member_dob: {
        Args: { _dob: string; _user_id: string }
        Returns: undefined
      }
      admin_set_payment_secret: {
        Args: { _name: string; _value: string }
        Returns: string
      }
      admin_wallet_adjust: {
        Args: { _amount: number; _reason: string; _user: string }
        Returns: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          id: string
          idempotency_key: string
          metadata: Json
          payment_id: string | null
          reference_id: string | null
          type: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallet_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      award_points: {
        Args: { _amount: number; _reason: string; _ref: string; _user: string }
        Returns: number
      }
      birthday_is_today: { Args: { _dob: string }; Returns: boolean }
      can_view_contest: {
        Args: { _contest: string; _uid: string }
        Returns: boolean
      }
      cancel_contest: { Args: { _contest: string }; Returns: undefined }
      cast_contest_vote: {
        Args: { _candidate: string; _code?: string; _contest: string }
        Returns: Json
      }
      check_badges: { Args: { _user: string }; Returns: undefined }
      claim_daily_reward: { Args: never; Returns: Json }
      claim_moderation_queue: {
        Args: { _limit?: number }
        Returns: {
          attempts: number
          id: string
          kind: string
          ref_id: string
        }[]
      }
      clear_conversation: {
        Args: { _conversation_id: string }
        Returns: number
      }
      community_today: { Args: never; Returns: string }
      connections_blocked_with: { Args: { _owner: string }; Returns: boolean }
      connections_profile_visible: {
        Args: { _owner: string }
        Returns: boolean
      }
      consume_email_short_link:
        | { Args: { _token: string }; Returns: string }
        | { Args: { _token: string; _user_agent?: string }; Returns: string }
      consume_rate_limit: {
        Args: {
          _key: string
          _max: number
          _scope: string
          _window_seconds?: number
        }
        Returns: boolean
      }
      contest_code_hash: {
        Args: { _code: string; _contest: string }
        Returns: string
      }
      contest_code_normalize: { Args: { _code: string }; Returns: string }
      conversation_send_status: {
        Args: { _conversation_id: string }
        Returns: Json
      }
      create_contest: {
        Args: {
          _allow_code_voters: boolean
          _allow_group_voters: boolean
          _candidates: Json
          _description: string
          _ends_at: string
          _results_visibility: string
          _starts_at: string
          _subgroup_id: string
          _title: string
        }
        Returns: string
      }
      create_email_short_link: {
        Args: { _purpose?: string; _target_url: string; _ttl_seconds?: number }
        Returns: string
      }
      dating_conversation_between: {
        Args: { _a: string; _b: string }
        Returns: string
      }
      dating_current_plan: {
        Args: { _uid: string }
        Returns: {
          billing_period: string
          code: string
          created_at: string
          currency: string
          description: string | null
          duration_days: number
          features: Json
          id: string
          is_active: boolean
          is_recommended: boolean
          is_visible: boolean
          limits: Json
          name: string
          price_minor: number
          promo_price_minor: number | null
          sort_order: number
          tier: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "subscription_plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      dating_has_entitlement: {
        Args: { _key: string; _uid: string }
        Returns: boolean
      }
      dating_has_reached_out: {
        Args: { _from: string; _to: string }
        Returns: boolean
      }
      dating_is_blocked: { Args: { _a: string; _b: string }; Returns: boolean }
      dating_is_match: { Args: { _a: string; _b: string }; Returns: boolean }
      dating_likes_received: {
        Args: { _limit?: number; _offset?: number; _unseen_only?: boolean }
        Returns: Json
      }
      dating_limit: { Args: { _key: string; _uid: string }; Returns: number }
      dating_mark_likes_seen: { Args: never; Returns: undefined }
      dating_my_matches: {
        Args: { _limit?: number; _offset?: number }
        Returns: Json
      }
      dating_react: { Args: { _kind: string; _target: string }; Returns: Json }
      dating_start_conversation: { Args: { _target: string }; Returns: Json }
      dating_today: { Args: never; Returns: string }
      dating_user_in_good_standing: { Args: { _uid: string }; Returns: boolean }
      decide_join_request: {
        Args: { _approve: boolean; _request_id: string }
        Returns: undefined
      }
      delete_conversation: {
        Args: { _conversation_id: string }
        Returns: undefined
      }
      delete_message_for_everyone: {
        Args: { _message_id: string }
        Returns: undefined
      }
      dispatch_facebook_share: {
        Args: { _action?: string; _fb_post_id?: string; _thread_id: string }
        Returns: undefined
      }
      edit_message: {
        Args: { _message_id: string; _new_content: string }
        Returns: undefined
      }
      email_is_registered: { Args: { _email: string }; Returns: boolean }
      email_registration_status: {
        Args: { _email: string }
        Returns: {
          is_registered: boolean
          is_verified: boolean
        }[]
      }
      enforce_client_rate_limit: {
        Args: { _max: number; _scope: string; _window_seconds?: number }
        Returns: undefined
      }
      enforce_rate_limit: {
        Args: { _max: number; _scope: string; _window_seconds?: number }
        Returns: undefined
      }
      facebook_share_blocker: { Args: { _thread_id: string }; Returns: string }
      forward_message: {
        Args: { _message_id: string; _to_conversation_id: string }
        Returns: string
      }
      generate_contest_codes: {
        Args: { _contest: string; _count: number }
        Returns: string[]
      }
      get_active_donation_accounts: {
        Args: never
        Returns: {
          account_name: string
          account_number: string
          account_type: string
          bank_name: string
          crypto_currency: string
          crypto_network: string
          description: string
          id: string
          order_index: number
          wallet_address: string
        }[]
      }
      get_contest: { Args: { _contest: string }; Returns: Json }
      get_leaderboard: {
        Args: { _limit?: number; _period?: string }
        Returns: {
          avatar_url: string
          display_name: string
          level: number
          points: number
          rank: number
          user_id: string
          username: string
        }[]
      }
      get_my_dating_entitlements: { Args: never; Returns: Json }
      get_my_privacy: { Args: never; Returns: Json }
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
          message_privacy: string
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
      get_my_rank: { Args: { _period?: string }; Returns: Json }
      get_my_rewards: { Args: never; Returns: Json }
      get_payment_options: {
        Args: never
        Returns: {
          display_name: string
          provider: string
        }[]
      }
      get_payment_secrets: {
        Args: never
        Returns: {
          name: string
          value: string
        }[]
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
      get_push_internal_secret: { Args: never; Returns: string }
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
      is_displayed_storage_object: {
        Args: { _bucket: string; _name: string }
        Returns: boolean
      }
      is_subgroup_admin: {
        Args: { _subgroup_id: string; _user_id: string }
        Returns: boolean
      }
      is_subgroup_member: {
        Args: { _subgroup_id: string; _user_id: string }
        Returns: boolean
      }
      log_monetization_event: {
        Args: { _event: string; _metadata?: Json; _uid: string }
        Returns: undefined
      }
      mark_conversation_read: {
        Args: { _conversation_id: string }
        Returns: number
      }
      mark_message_read: { Args: { _message_id: string }; Returns: undefined }
      mask_payment_secret: { Args: { _value: string }; Returns: string }
      member_message_privacy: { Args: { _uid: string }; Returns: string }
      my_thread_ids: {
        Args: never
        Returns: {
          id: string
        }[]
      }
      payment_apply_refund: {
        Args: { _provider: string; _ref: string }
        Returns: string
      }
      payment_apply_result: {
        Args: {
          _currency: string
          _paid_minor: number
          _provider: string
          _provider_reference?: string
          _reference: string
          _status: string
        }
        Returns: string
      }
      payment_attach_checkout: {
        Args: {
          _checkout_url: string
          _provider_reference: string
          _reference: string
        }
        Returns: undefined
      }
      payment_create_transaction: {
        Args: { _plan_id: string; _provider: string; _user: string }
        Returns: {
          amount_minor: number
          checkout_url: string | null
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          mode: string
          plan_id: string | null
          provider: string
          provider_reference: string | null
          purpose: string
          reference: string
          refunded_at: string | null
          status: string
          user_id: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "payment_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pin_subgroup_thread: {
        Args: { _pinned: boolean; _thread_id: string }
        Returns: undefined
      }
      points_daily_cap: { Args: { _reason: string }; Returns: number }
      points_level: { Args: { _points: number }; Returns: number }
      prune_email_short_links: { Args: never; Returns: undefined }
      prune_issue_report_contact_emails: { Args: never; Returns: undefined }
      prune_search_rate_limits: { Args: never; Returns: undefined }
      queue_popular_threads_for_facebook: {
        Args: {
          _daily_cap?: number
          _min_replies?: number
          _min_upvotes?: number
        }
        Returns: number
      }
      redeem_subgroup_invite: { Args: { _token: string }; Returns: string }
      resolve_username_to_email: {
        Args: { _username: string }
        Returns: string
      }
      review_contest: {
        Args: { _approve: boolean; _contest: string; _note?: string }
        Returns: undefined
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
      set_my_privacy: {
        Args: { _incognito?: boolean; _message_privacy?: string }
        Returns: Json
      }
      share_thread_to_facebook: {
        Args: { _thread_id: string }
        Returns: string
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
      sync_reputation: { Args: { _user: string }; Returns: undefined }
      track_monetization_event: {
        Args: { _event: string; _metadata?: Json }
        Returns: undefined
      }
      verify_cron_token: { Args: { _token: string }; Returns: boolean }
      wallet_apply: {
        Args: {
          _amount: number
          _idempotency_key: string
          _metadata?: Json
          _payment_id?: string
          _reference_id?: string
          _type: string
          _user: string
        }
        Returns: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          id: string
          idempotency_key: string
          metadata: Json
          payment_id: string | null
          reference_id: string | null
          type: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallet_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
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
      app_role: ["Super Admin", "Admin", "Member"],
    },
  },
} as const
