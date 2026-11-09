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
      abia_this_week_emails: {
        Row: {
          last_sent_at: string | null
          opted_out_at: string | null
          token: string
          user_id: string
        }
        Insert: {
          last_sent_at?: string | null
          opted_out_at?: string | null
          token?: string
          user_id: string
        }
        Update: {
          last_sent_at?: string | null
          opted_out_at?: string | null
          token?: string
          user_id?: string
        }
        Relationships: []
      }
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
      ai_provider_keys: {
        Row: {
          preview: string
          provider: string
          updated_at: string
          updated_by: string | null
          vault_id: string
        }
        Insert: {
          preview: string
          provider: string
          updated_at?: string
          updated_by?: string | null
          vault_id: string
        }
        Update: {
          preview?: string
          provider?: string
          updated_at?: string
          updated_by?: string | null
          vault_id?: string
        }
        Relationships: []
      }
      ai_provider_settings: {
        Row: {
          fallback: boolean
          id: boolean
          models: Json
          provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          fallback?: boolean
          id?: boolean
          models?: Json
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          fallback?: boolean
          id?: boolean
          models?: Json
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          created_at: string
          feature: string
          fell_back: boolean
          id: number
          ok: boolean
          provider: string
        }
        Insert: {
          created_at?: string
          feature: string
          fell_back?: boolean
          id?: number
          ok: boolean
          provider: string
        }
        Update: {
          created_at?: string
          feature?: string
          fell_back?: boolean
          id?: number
          ok?: boolean
          provider?: string
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
      app_tester_invites: {
        Row: {
          attempts: number
          last_sent_at: string | null
          opted_out_at: string | null
          token: string
          user_id: string
        }
        Insert: {
          attempts?: number
          last_sent_at?: string | null
          opted_out_at?: string | null
          token?: string
          user_id: string
        }
        Update: {
          attempts?: number
          last_sent_at?: string | null
          opted_out_at?: string | null
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      backup_file_state: {
        Row: {
          bucket_id: string
          copied_updated_at: string
          name: string
        }
        Insert: {
          bucket_id: string
          copied_updated_at: string
          name: string
        }
        Update: {
          bucket_id?: string
          copied_updated_at?: string
          name?: string
        }
        Relationships: []
      }
      backup_runs: {
        Row: {
          db_snapshot: string | null
          error: string | null
          files_copied: number
          files_left: number | null
          finished_at: string | null
          id: number
          ok: boolean | null
          rows_saved: number
          started_at: string
          tables_saved: number
        }
        Insert: {
          db_snapshot?: string | null
          error?: string | null
          files_copied?: number
          files_left?: number | null
          finished_at?: string | null
          id?: number
          ok?: boolean | null
          rows_saved?: number
          started_at?: string
          tables_saved?: number
        }
        Update: {
          db_snapshot?: string | null
          error?: string | null
          files_copied?: number
          files_left?: number | null
          finished_at?: string | null
          id?: number
          ok?: boolean | null
          rows_saved?: number
          started_at?: string
          tables_saved?: number
        }
        Relationships: []
      }
      backup_settings: {
        Row: {
          enabled: boolean
          id: boolean
          skip_buckets: string[]
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          id?: boolean
          skip_buckets?: string[]
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          id?: boolean
          skip_buckets?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      birthday_wishes: {
        Row: {
          birthday_user: string
          created_at: string
          from_team: boolean
          from_user: string
          message: string
          year: number
        }
        Insert: {
          birthday_user: string
          created_at?: string
          from_team?: boolean
          from_user: string
          message: string
          year: number
        }
        Update: {
          birthday_user?: string
          created_at?: string
          from_team?: boolean
          from_user?: string
          message?: string
          year?: number
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
      community_events: {
        Row: {
          created_at: string
          description: string
          ends_at: string | null
          id: string
          lga: string | null
          online_link: string | null
          place: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          starts_at: string
          status: string
          submitted_by: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description: string
          ends_at?: string | null
          id?: string
          lga?: string | null
          online_link?: string | null
          place?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          starts_at: string
          status?: string
          submitted_by?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          ends_at?: string | null
          id?: string
          lga?: string | null
          online_link?: string | null
          place?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          starts_at?: string
          status?: string
          submitted_by?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_events_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_events_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connect_follows: {
        Row: {
          created_at: string
          followed_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followed_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followed_id?: string
          follower_id?: string
        }
        Relationships: []
      }
      connect_photo_likes: {
        Row: {
          created_at: string
          liker_id: string
          owner_id: string
          photo_url: string
        }
        Insert: {
          created_at?: string
          liker_id: string
          owner_id: string
          photo_url: string
        }
        Update: {
          created_at?: string
          liker_id?: string
          owner_id?: string
          photo_url?: string
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
          position_id: string | null
        }
        Insert: {
          bio?: string | null
          contest_id: string
          id?: string
          name: string
          photo_url?: string | null
          position?: number
          position_id?: string | null
        }
        Update: {
          bio?: string | null
          contest_id?: string
          id?: string
          name?: string
          photo_url?: string | null
          position?: number
          position_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contest_candidates_contest_id_fkey"
            columns: ["contest_id"]
            isOneToOne: false
            referencedRelation: "contests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contest_candidates_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "contest_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      contest_positions: {
        Row: {
          contest_id: string
          id: string
          max_choices: number
          position: number
          title: string
        }
        Insert: {
          contest_id: string
          id?: string
          max_choices?: number
          position?: number
          title: string
        }
        Update: {
          contest_id?: string
          id?: string
          max_choices?: number
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "contest_positions_contest_id_fkey"
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
          is_public: boolean
          members_before_open: boolean
          min_account_days: number
          results_announced_at: string | null
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
          is_public?: boolean
          members_before_open?: boolean
          min_account_days?: number
          results_announced_at?: string | null
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
          is_public?: boolean
          members_before_open?: boolean
          min_account_days?: number
          results_announced_at?: string | null
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
      daily_questions: {
        Row: {
          id: number
          last_used: string | null
          question: string
          thread_id: string | null
        }
        Insert: {
          id?: number
          last_used?: string | null
          question: string
          thread_id?: string | null
        }
        Update: {
          id?: number
          last_used?: string | null
          question?: string
          thread_id?: string | null
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
      group_champions: {
        Row: {
          added_by: string | null
          created_at: string
          subgroup_id: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          subgroup_id: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          subgroup_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_champions_subgroup_id_fkey"
            columns: ["subgroup_id"]
            isOneToOne: false
            referencedRelation: "subgroups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_champions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_champions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_desk_welcomes: {
        Row: {
          created_at: string
          reply_id: string | null
          subgroup_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          reply_id?: string | null
          subgroup_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          reply_id?: string | null
          subgroup_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_desk_welcomes_subgroup_id_fkey"
            columns: ["subgroup_id"]
            isOneToOne: false
            referencedRelation: "subgroups"
            referencedColumns: ["id"]
          },
        ]
      }
      helper_replies: {
        Row: {
          created_at: string
          line_id: number | null
          reply_id: string | null
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          line_id?: number | null
          reply_id?: string | null
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          line_id?: number | null
          reply_id?: string | null
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "helper_replies_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      helper_reply_accounts: {
        Row: {
          added_at: string
          user_id: string
        }
        Insert: {
          added_at?: string
          user_id: string
        }
        Update: {
          added_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "helper_reply_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helper_reply_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      helper_reply_lines: {
        Row: {
          id: number
          line: string
        }
        Insert: {
          id?: number
          line: string
        }
        Update: {
          id?: number
          line?: string
        }
        Relationships: []
      }
      helper_reply_settings: {
        Row: {
          enabled: boolean
          id: boolean
          per_hour: number
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          id?: boolean
          per_hour?: number
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          id?: boolean
          per_hour?: number
          updated_at?: string
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
      live_host_bans: {
        Row: {
          banned_by: string | null
          created_at: string
          reason: string | null
          user_id: string
        }
        Insert: {
          banned_by?: string | null
          created_at?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          banned_by?: string | null
          created_at?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      live_host_blocks: {
        Row: {
          blocked_id: string
          created_at: string
          host_id: string
        }
        Insert: {
          blocked_id: string
          created_at?: string
          host_id: string
        }
        Update: {
          blocked_id?: string
          created_at?: string
          host_id?: string
        }
        Relationships: []
      }
      live_room_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          is_deleted: boolean
          is_pinned: boolean
          room_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          is_pinned?: boolean
          room_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          is_pinned?: boolean
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_room_comments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      live_room_people: {
        Row: {
          hand_raised: boolean
          joined_at: string
          last_seen: string
          removed: boolean
          role: string
          room_id: string
          user_id: string
        }
        Insert: {
          hand_raised?: boolean
          joined_at?: string
          last_seen?: string
          removed?: boolean
          role?: string
          room_id: string
          user_id: string
        }
        Update: {
          hand_raised?: boolean
          joined_at?: string
          last_seen?: string
          removed?: boolean
          role?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_room_people_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      live_room_reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reported_user_id: string | null
          reporter_id: string
          room_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reported_user_id?: string | null
          reporter_id: string
          room_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reported_user_id?: string | null
          reporter_id?: string
          room_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_room_reports_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      live_rooms: {
        Row: {
          ended_at: string | null
          ended_reason: string | null
          ends_at: string
          host_id: string
          id: string
          kind: string
          participant_minutes: number
          peak_listeners: number
          started_at: string
          status: string
          subgroup_id: string | null
          title: string
        }
        Insert: {
          ended_at?: string | null
          ended_reason?: string | null
          ends_at: string
          host_id: string
          id?: string
          kind?: string
          participant_minutes?: number
          peak_listeners?: number
          started_at?: string
          status?: string
          subgroup_id?: string | null
          title: string
        }
        Update: {
          ended_at?: string | null
          ended_reason?: string | null
          ends_at?: string
          host_id?: string
          id?: string
          kind?: string
          participant_minutes?: number
          peak_listeners?: number
          started_at?: string
          status?: string
          subgroup_id?: string | null
          title?: string
        }
        Relationships: []
      }
      live_service_config: {
        Row: {
          api_key: string
          id: boolean
          secret_preview: string
          secret_vault_id: string
          updated_at: string
          updated_by: string | null
          url: string
        }
        Insert: {
          api_key: string
          id?: boolean
          secret_preview: string
          secret_vault_id: string
          updated_at?: string
          updated_by?: string | null
          url: string
        }
        Update: {
          api_key?: string
          id?: boolean
          secret_preview?: string
          secret_vault_id?: string
          updated_at?: string
          updated_by?: string | null
          url?: string
        }
        Relationships: []
      }
      live_settings: {
        Row: {
          enabled: boolean
          id: boolean
          max_listeners: number
          max_rooms_at_once: number
          monthly_minutes: number
          room_minutes: number
          testers_only: boolean
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          id?: boolean
          max_listeners?: number
          max_rooms_at_once?: number
          monthly_minutes?: number
          room_minutes?: number
          testers_only?: boolean
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          id?: boolean
          max_listeners?: number
          max_rooms_at_once?: number
          monthly_minutes?: number
          room_minutes?: number
          testers_only?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      live_testers: {
        Row: {
          added_by: string | null
          created_at: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          user_id?: string
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
      member_email_settings: {
        Row: {
          enabled: boolean
          key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      member_invite_codes: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      member_invites: {
        Row: {
          created_at: string
          invitee_id: string
          inviter_id: string
          rewarded_at: string | null
        }
        Insert: {
          created_at?: string
          invitee_id: string
          inviter_id: string
          rewarded_at?: string | null
        }
        Update: {
          created_at?: string
          invitee_id?: string
          inviter_id?: string
          rewarded_at?: string | null
        }
        Relationships: []
      }
      member_spotlights: {
        Row: {
          about: string
          created_at: string
          created_by: string | null
          headline: string
          id: string
          member_id: string
          month: string
          quote: string | null
        }
        Insert: {
          about: string
          created_at?: string
          created_by?: string | null
          headline: string
          id?: string
          member_id: string
          month: string
          quote?: string | null
        }
        Update: {
          about?: string
          created_at?: string
          created_by?: string | null
          headline?: string
          id?: string
          member_id?: string
          month?: string
          quote?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_spotlights_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_spotlights_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
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
      moderator_actions: {
        Row: {
          action: string
          created_at: string
          excerpt: string | null
          id: string
          moderator_id: string
          report_id: string | null
          target_id: string
          target_type: string
          undone_at: string | null
        }
        Insert: {
          action: string
          created_at?: string
          excerpt?: string | null
          id?: string
          moderator_id: string
          report_id?: string | null
          target_id: string
          target_type: string
          undone_at?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          moderator_id?: string
          report_id?: string | null
          target_id?: string
          target_type?: string
          undone_at?: string | null
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
      newcomer_nudges: {
        Row: {
          sent_at: string
          stage: number
          user_id: string
        }
        Insert: {
          sent_at?: string
          stage: number
          user_id: string
        }
        Update: {
          sent_at?: string
          stage?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newcomer_nudges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newcomer_nudges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      newsdesk_followups: {
        Row: {
          created_at: string
          reply_id: string | null
          thread_id: string
        }
        Insert: {
          created_at?: string
          reply_id?: string | null
          thread_id: string
        }
        Update: {
          created_at?: string
          reply_id?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsdesk_followups_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsdesk_followups_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: true
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      newsdesk_posts: {
        Row: {
          banner_title: string | null
          banner_url: string | null
          category_id: string
          category_slug: string
          content: string
          created_at: string
          hold_reason: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          run_date: string
          scope: string
          share_path: string | null
          sources: Json
          status: string
          tags: string[]
          thread_id: string | null
          title: string
        }
        Insert: {
          banner_title?: string | null
          banner_url?: string | null
          category_id: string
          category_slug: string
          content: string
          created_at?: string
          hold_reason?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          run_date: string
          scope: string
          share_path?: string | null
          sources?: Json
          status?: string
          tags?: string[]
          thread_id?: string | null
          title: string
        }
        Update: {
          banner_title?: string | null
          banner_url?: string | null
          category_id?: string
          category_slug?: string
          content?: string
          created_at?: string
          hold_reason?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          run_date?: string
          scope?: string
          share_path?: string | null
          sources?: Json
          status?: string
          tags?: string[]
          thread_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsdesk_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsdesk_posts_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      newsdesk_runs: {
        Row: {
          finished_at: string | null
          held: number
          id: string
          note: string | null
          published: number
          started_at: string
          stories_found: number
          trigger: string
        }
        Insert: {
          finished_at?: string | null
          held?: number
          id?: string
          note?: string | null
          published?: number
          started_at?: string
          stories_found?: number
          trigger: string
        }
        Update: {
          finished_at?: string | null
          held?: number
          id?: string
          note?: string | null
          published?: number
          started_at?: string
          stories_found?: number
          trigger?: string
        }
        Relationships: []
      }
      newsdesk_seen_links: {
        Row: {
          baseline: boolean
          first_seen: string
          source: string
          url: string
        }
        Insert: {
          baseline?: boolean
          first_seen?: string
          source: string
          url: string
        }
        Update: {
          baseline?: boolean
          first_seen?: string
          source?: string
          url?: string
        }
        Relationships: []
      }
      newsdesk_settings: {
        Row: {
          alternate_author_id: string | null
          alternate_next: boolean
          author_id: string | null
          daily_total: number
          default_forum_limit: number
          enabled: boolean
          forum_choices: Json | null
          forum_limits: Json
          id: boolean
          log_cleared_at: string | null
          log_keep_days: number
          max_posts_per_day: number
          review_slugs: string[]
          updated_at: string
        }
        Insert: {
          alternate_author_id?: string | null
          alternate_next?: boolean
          author_id?: string | null
          daily_total?: number
          default_forum_limit?: number
          enabled?: boolean
          forum_choices?: Json | null
          forum_limits?: Json
          id?: boolean
          log_cleared_at?: string | null
          log_keep_days?: number
          max_posts_per_day?: number
          review_slugs?: string[]
          updated_at?: string
        }
        Update: {
          alternate_author_id?: string | null
          alternate_next?: boolean
          author_id?: string | null
          daily_total?: number
          default_forum_limit?: number
          enabled?: boolean
          forum_choices?: Json | null
          forum_limits?: Json
          id?: boolean
          log_cleared_at?: string | null
          log_keep_days?: number
          max_posts_per_day?: number
          review_slugs?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsdesk_settings_alternate_author_id_fkey"
            columns: ["alternate_author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsdesk_settings_alternate_author_id_fkey"
            columns: ["alternate_author_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsdesk_settings_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsdesk_settings_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
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
          donation_id: string | null
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
          user_id: string | null
          verified_at: string | null
        }
        Insert: {
          amount_minor: number
          checkout_url?: string | null
          created_at?: string
          currency: string
          donation_id?: string | null
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
          user_id?: string | null
          verified_at?: string | null
        }
        Update: {
          amount_minor?: number
          checkout_url?: string | null
          created_at?: string
          currency?: string
          donation_id?: string | null
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
          user_id?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_donation_id_fkey"
            columns: ["donation_id"]
            isOneToOne: false
            referencedRelation: "donations"
            referencedColumns: ["id"]
          },
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
      premium_invites: {
        Row: {
          last_sent_at: string | null
          opted_out_at: string | null
          token: string
          user_id: string
        }
        Insert: {
          last_sent_at?: string | null
          opted_out_at?: string | null
          token?: string
          user_id: string
        }
        Update: {
          last_sent_at?: string | null
          opted_out_at?: string | null
          token?: string
          user_id?: string
        }
        Relationships: []
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
          interests: string[]
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
          onboarded_at: string | null
          reputation: number
          role: string | null
          sex: string | null
          share_birthday: boolean
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
          interests?: string[]
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
          onboarded_at?: string | null
          reputation?: number
          role?: string | null
          sex?: string | null
          share_birthday?: boolean
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
          interests?: string[]
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
          onboarded_at?: string | null
          reputation?: number
          role?: string | null
          sex?: string | null
          share_birthday?: boolean
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
      relationship_access_settings: {
        Row: {
          id: boolean
          plans_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          plans_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          plans_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
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
          business_name: string | null
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
          services: string | null
          sex: string | null
          updated_at: string
          user_id: string
          work_experience: string | null
        }
        Insert: {
          about?: string | null
          business_name?: string | null
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
          services?: string | null
          sex?: string | null
          updated_at?: string
          user_id: string
          work_experience?: string | null
        }
        Update: {
          about?: string | null
          business_name?: string | null
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
          services?: string | null
          sex?: string | null
          updated_at?: string
          user_id?: string
          work_experience?: string | null
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
          reaction: string | null
          reply_id: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          reaction?: string | null
          reply_id: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          reaction?: string | null
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
      spotlight_nominations: {
        Row: {
          created_at: string
          id: string
          nominated_by: string | null
          nominee_id: string
          reason: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          nominated_by?: string | null
          nominee_id: string
          reason: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          nominated_by?: string | null
          nominee_id?: string
          reason?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "spotlight_nominations_nominated_by_fkey"
            columns: ["nominated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spotlight_nominations_nominated_by_fkey"
            columns: ["nominated_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spotlight_nominations_nominee_id_fkey"
            columns: ["nominee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spotlight_nominations_nominee_id_fkey"
            columns: ["nominee_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
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
      subgroup_topics: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          emoji: string | null
          id: string
          name: string
          subgroup_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          emoji?: string | null
          id?: string
          name: string
          subgroup_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          emoji?: string | null
          id?: string
          name?: string
          subgroup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subgroup_topics_subgroup_id_fkey"
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
          icon: string | null
          id: string
          is_active: boolean
          is_featured: boolean
          is_private: boolean
          kind: string
          lga: string | null
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
          icon?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          is_private?: boolean
          kind?: string
          lga?: string | null
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
          icon?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          is_private?: boolean
          kind?: string
          lga?: string | null
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
      success_stories: {
        Row: {
          created_at: string
          id: string
          person_name: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          story: string
          submitted_by: string | null
          tag: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          person_name?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          story: string
          submitted_by?: string | null
          tag: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          person_name?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          story?: string
          submitted_by?: string | null
          tag?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "success_stories_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "success_stories_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_appeals: {
        Row: {
          last_sent_at: string | null
          opted_out_at: string | null
          token: string
          user_id: string
        }
        Insert: {
          last_sent_at?: string | null
          opted_out_at?: string | null
          token?: string
          user_id: string
        }
        Update: {
          last_sent_at?: string | null
          opted_out_at?: string | null
          token?: string
          user_id?: string
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
      thread_follows: {
        Row: {
          created_at: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_follows_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_votes: {
        Row: {
          created_at: string
          id: string
          reaction: string | null
          thread_id: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          reaction?: string | null
          thread_id: string
          user_id: string
          value?: number
        }
        Update: {
          created_at?: string
          id?: string
          reaction?: string | null
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
          best_reply_id: string | null
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
          topic_id: string | null
          updated_at: string
          upvotes: number
          user_id: string | null
          view_count: number
        }
        Insert: {
          allow_replies?: boolean
          author_id?: string | null
          best_reply_id?: string | null
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
          topic_id?: string | null
          updated_at?: string
          upvotes?: number
          user_id?: string | null
          view_count?: number
        }
        Update: {
          allow_replies?: boolean
          author_id?: string | null
          best_reply_id?: string | null
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
          topic_id?: string | null
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
          {
            foreignKeyName: "threads_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "subgroup_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      trusted_members: {
        Row: {
          added_by: string | null
          created_at: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trusted_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trusted_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      unanswered_alerts: {
        Row: {
          alerted_at: string
          thread_id: string
        }
        Insert: {
          alerted_at?: string
          thread_id: string
        }
        Update: {
          alerted_at?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unanswered_alerts_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: true
            referencedRelation: "threads"
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
      volunteer_applications: {
        Row: {
          admin_note: string | null
          answers: Json
          created_at: string
          decision_emailed_at: string | null
          email: string
          experience: string
          full_name: string
          hours_per_week: string
          id: string
          lga: string | null
          links: string | null
          location: string
          motivation: string
          phone: string | null
          powers_granted_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          role: string
          status: string
          user_id: string | null
        }
        Insert: {
          admin_note?: string | null
          answers?: Json
          created_at?: string
          decision_emailed_at?: string | null
          email: string
          experience: string
          full_name: string
          hours_per_week: string
          id?: string
          lga?: string | null
          links?: string | null
          location: string
          motivation: string
          phone?: string | null
          powers_granted_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role: string
          status?: string
          user_id?: string | null
        }
        Update: {
          admin_note?: string | null
          answers?: Json
          created_at?: string
          decision_emailed_at?: string | null
          email?: string
          experience?: string
          full_name?: string
          hours_per_week?: string
          id?: string
          lga?: string | null
          links?: string | null
          location?: string
          motivation?: string
          phone?: string | null
          powers_granted_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      volunteer_team: {
        Row: {
          added_by: string | null
          application_id: string | null
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          application_id?: string | null
          created_at?: string
          role: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          application_id?: string | null
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_team_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "volunteer_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_team_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_team_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
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
      abia_this_week_claim: {
        Args: { _limit?: number }
        Returns: {
          email: string
          name: string
          token: string
          user_id: string
        }[]
      }
      abia_this_week_opt_out: { Args: { _token: string }; Returns: boolean }
      abia_this_week_posts: {
        Args: { _limit?: number }
        Returns: {
          id: string
          replies: number
          title: string
        }[]
      }
      add_default_topics: { Args: { _group: string }; Returns: undefined }
      admin_ai_usage: {
        Args: { _days?: number }
        Returns: {
          calls: number
          failed: number
          feature: string
          fell_back: number
          provider: string
        }[]
      }
      admin_backup_status: { Args: never; Returns: Json }
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
      admin_clear_ai_key: { Args: { _provider: string }; Returns: undefined }
      admin_clear_live_service: { Args: never; Returns: undefined }
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
      admin_helper_replies: { Args: never; Returns: Json }
      admin_helper_reply_account: {
        Args: { _add: boolean; _user_id: string }
        Returns: undefined
      }
      admin_list_trusted: {
        Args: never
        Returns: {
          avatar_url: string
          created_at: string
          display_name: string
          user_id: string
          username: string
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
      admin_live_close_reports: {
        Args: { _room_id: string }
        Returns: undefined
      }
      admin_live_overview: { Args: never; Returns: Json }
      admin_live_service_status: { Args: never; Returns: Json }
      admin_live_settings: {
        Args: {
          _enabled: boolean
          _max_listeners: number
          _max_rooms_at_once: number
          _monthly_minutes: number
          _room_minutes: number
          _testers_only: boolean
        }
        Returns: undefined
      }
      admin_live_stop_host: {
        Args: { _on: boolean; _reason?: string; _user_id: string }
        Returns: undefined
      }
      admin_live_tester: {
        Args: { _on: boolean; _user_id: string }
        Returns: undefined
      }
      admin_member_email_status: { Args: never; Returns: Json }
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
      admin_set_ai_key: {
        Args: { _provider: string; _value: string }
        Returns: string
      }
      admin_set_ai_settings: {
        Args: { _fallback: boolean; _models: Json; _provider: string }
        Returns: undefined
      }
      admin_set_group_champion: {
        Args: { _on: boolean; _subgroup: string; _user: string }
        Returns: undefined
      }
      admin_set_helper_replies: {
        Args: { _enabled: boolean; _per_hour?: number }
        Returns: undefined
      }
      admin_set_live_service: {
        Args: { _api_key: string; _secret: string; _url: string }
        Returns: Json
      }
      admin_set_member_dob: {
        Args: { _dob: string; _user_id: string }
        Returns: undefined
      }
      admin_set_member_email: {
        Args: { _enabled: boolean; _key: string }
        Returns: undefined
      }
      admin_set_payment_secret: {
        Args: { _name: string; _value: string }
        Returns: string
      }
      admin_set_relationship_plan_mode: {
        Args: { _enabled: boolean }
        Returns: undefined
      }
      admin_set_trusted: {
        Args: { _on: boolean; _user: string }
        Returns: undefined
      }
      admin_set_volunteer_role: {
        Args: { _role: string; _user: string }
        Returns: undefined
      }
      admin_volunteer_team: {
        Args: never
        Returns: {
          avatar_url: string
          created_at: string
          display_name: string
          from_application: boolean
          role: string
          user_id: string
          username: string
        }[]
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
      alert_unanswered_posts: { Args: never; Returns: number }
      announce_contest_results: { Args: { _contest: string }; Returns: boolean }
      announce_due_contest_results: { Args: never; Returns: number }
      app_tester_invite_claim: {
        Args: { _limit?: number }
        Returns: {
          email: string
          name: string
          token: string
          user_id: string
        }[]
      }
      app_tester_invite_opt_out: { Args: { _token: string }; Returns: boolean }
      app_tester_invite_retry: {
        Args: { _user_id: string }
        Returns: undefined
      }
      award_points: {
        Args: { _amount: number; _reason: string; _ref: string; _user: string }
        Returns: number
      }
      backup_auth_users: {
        Args: { _limit?: number; _offset: number }
        Returns: Json
      }
      backup_files_to_copy: {
        Args: { _limit?: number }
        Returns: {
          bucket_id: string
          mimetype: string
          name: string
          size: number
          updated_at: string
          waiting: number
        }[]
      }
      backup_last_snapshot: { Args: never; Returns: string }
      backup_mark_copied: {
        Args: { _bucket: string; _name: string; _updated_at: string }
        Returns: undefined
      }
      backup_table_page: {
        Args: { _limit?: number; _offset: number; _table: string }
        Returns: Json
      }
      backup_tables: { Args: never; Returns: string[] }
      birthday_ids_today: {
        Args: never
        Returns: {
          id: string
        }[]
      }
      birthday_is_today: { Args: { _dob: string }; Returns: boolean }
      birthday_year_now: { Args: never; Returns: number }
      birthdays_today: { Args: never; Returns: Json }
      can_review_community: { Args: { _user_id: string }; Returns: boolean }
      can_view_contest: {
        Args: { _contest: string; _uid: string }
        Returns: boolean
      }
      cancel_contest: { Args: { _contest: string }; Returns: undefined }
      cast_contest_ballot: {
        Args: { _choices: Json; _code?: string; _contest: string }
        Returns: Json
      }
      cast_contest_vote: {
        Args: { _candidate: string; _code?: string; _contest: string }
        Returns: Json
      }
      check_badges: { Args: { _user: string }; Returns: undefined }
      claim_daily_reward: { Args: never; Returns: Json }
      claim_invite: { Args: { _code: string }; Returns: boolean }
      claim_moderation_queue: {
        Args: { _limit?: number }
        Returns: {
          attempts: number
          id: string
          kind: string
          ref_id: string
        }[]
      }
      claim_starter_bonus: { Args: never; Returns: number }
      claim_volunteer_powers: { Args: never; Returns: string }
      clear_conversation: {
        Args: { _conversation_id: string }
        Returns: number
      }
      community_can_read_thread: { Args: { _thread: string }; Returns: boolean }
      community_member_page: { Args: { _user: string }; Returns: Json }
      community_member_visible: { Args: { _owner: string }; Returns: boolean }
      community_require_member: { Args: never; Returns: string }
      community_review_queue: { Args: never; Returns: Json }
      community_today: { Args: never; Returns: string }
      complete_welcome: {
        Args: { _groups: string[]; _interests: string[] }
        Returns: Json
      }
      connect_account_ok: { Args: never; Returns: boolean }
      connect_member_posts: {
        Args: { _limit?: number; _user: string }
        Returns: {
          created_at: string
          id: string
          place: string
          title: string
          total: number
        }[]
      }
      connect_member_visible: { Args: { _owner: string }; Returns: boolean }
      connect_my_people: {
        Args: { _kind: string; _limit?: number; _offset?: number }
        Returns: {
          avatar_url: string
          display_name: string
          happened_at: string
          headline: string
          looking_for: string
          photo_url: string
          user_id: string
          username: string
        }[]
      }
      connect_notify: {
        Args: { _action: string; _owner: string; _type: string }
        Returns: undefined
      }
      connect_profile_summary: { Args: { _user: string }; Returns: Json }
      connect_search: {
        Args: { _q: string }
        Returns: {
          user_id: string
        }[]
      }
      connect_toggle_follow: { Args: { _target: string }; Returns: Json }
      connect_toggle_photo_like: {
        Args: { _owner: string; _photo: string }
        Returns: Json
      }
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
      contest_group_block: {
        Args: { _contest: string; _uid: string }
        Returns: string
      }
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
      create_election: { Args: { _c: Json }; Returns: string }
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
      desk_account: { Args: never; Returns: string }
      desk_welcome: {
        Args: {
          _intro: string
          _member: string
          _parent_reply: string
          _subgroup: string
          _thread: string
        }
        Returns: string
      }
      dispatch_facebook_share: {
        Args: { _action?: string; _fb_post_id?: string; _thread_id: string }
        Returns: undefined
      }
      donation_create_transaction: {
        Args: {
          _amount_minor: number
          _currency: string
          _donor_email: string
          _donor_name: string
          _is_anonymous: boolean
          _message: string
          _provider: string
          _user?: string
        }
        Returns: {
          amount_minor: number
          checkout_url: string | null
          created_at: string
          currency: string
          donation_id: string | null
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
          user_id: string | null
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "payment_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
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
      get_ai_config: { Args: never; Returns: Json }
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
      get_live_service_config: { Args: never; Returns: Json }
      get_my_dating_entitlements: { Args: never; Returns: Json }
      get_my_journey: { Args: never; Returns: Json }
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
          interests: string[]
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
          onboarded_at: string | null
          reputation: number
          role: string | null
          sex: string | null
          share_birthday: boolean
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
      get_reply_reactions: {
        Args: { _reply_ids: string[] }
        Returns: {
          reaction: string
          reply_id: string
          total: number
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
      get_thread_reactions: {
        Args: { _thread_id: string }
        Returns: {
          reaction: string
          total: number
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
      grant_volunteer_powers: {
        Args: { _app_id: string; _by: string; _user: string }
        Returns: string
      }
      group_welcome_thread: { Args: { _subgroup: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      helper_replies_resting: { Args: never; Returns: boolean }
      html_text: { Args: { _s: string }; Returns: string }
      increment_thread_view: {
        Args: { _thread_id: string }
        Returns: undefined
      }
      intro_first_name: {
        Args: { _display: string; _text: string }
        Returns: string
      }
      invite_reward: { Args: { _member: string }; Returns: undefined }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_displayed_storage_object: {
        Args: { _bucket: string; _name: string }
        Returns: boolean
      }
      is_moderator: { Args: { _user_id: string }; Returns: boolean }
      is_public_subgroup: { Args: { _subgroup_id: string }; Returns: boolean }
      is_subgroup_admin: {
        Args: { _subgroup_id: string; _user_id: string }
        Returns: boolean
      }
      is_subgroup_member: {
        Args: { _subgroup_id: string; _user_id: string }
        Returns: boolean
      }
      lga_group_for: { Args: { _lga: string }; Returns: string }
      lga_of_the_month: {
        Args: never
        Returns: {
          best_answers: number
          lga: string
          new_members: number
          replies: number
          score: number
        }[]
      }
      list_member_spotlights: {
        Args: never
        Returns: {
          about: string
          avatar_url: string
          display_name: string
          headline: string
          id: string
          lga: string
          member_id: string
          member_since: string
          month: string
          quote: string
          username: string
        }[]
      }
      list_success_stories: {
        Args: { _limit?: number }
        Returns: {
          id: string
          person_name: string
          published_at: string
          story: string
          tag: string
          title: string
        }[]
      }
      list_upcoming_events: {
        Args: never
        Returns: {
          description: string
          ends_at: string
          id: string
          lga: string
          online_link: string
          organiser_name: string
          place: string
          starts_at: string
          title: string
        }[]
      }
      live_allowed: { Args: { _uid: string }; Returns: boolean }
      live_comment: {
        Args: { _body: string; _room_id: string }
        Returns: string
      }
      live_end_room: { Args: { _room_id: string }; Returns: undefined }
      live_heartbeat: { Args: { _room_id: string }; Returns: Json }
      live_host_blocker: { Args: { _uid: string }; Returns: string }
      live_host_groups: {
        Args: { _uid: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      live_join_room: { Args: { _room_id: string }; Returns: string }
      live_minutes_this_month: { Args: never; Returns: number }
      live_moderate_comment: {
        Args: { _action: string; _comment_id: string }
        Returns: undefined
      }
      live_present_count: { Args: { _room_id: string }; Returns: number }
      live_raise_hand: {
        Args: { _room_id: string; _up: boolean }
        Returns: undefined
      }
      live_remove_person: {
        Args: { _block?: boolean; _room_id: string; _user_id: string }
        Returns: undefined
      }
      live_report: {
        Args: { _reason: string; _room_id: string; _user_id: string }
        Returns: undefined
      }
      live_role_of: {
        Args: { _room_id: string; _uid: string }
        Returns: string
      }
      live_room_comments_list: {
        Args: { _room_id: string }
        Returns: {
          avatar: string
          body: string
          created_at: string
          id: string
          is_pinned: boolean
          name: string
          user_id: string
        }[]
      }
      live_room_detail: { Args: { _room_id: string }; Returns: Json }
      live_rooms_now: {
        Args: never
        Returns: {
          ends_at: string
          group_name: string
          host_avatar: string
          host_id: string
          host_name: string
          id: string
          listening: number
          started_at: string
          subgroup_id: string
          title: string
        }[]
      }
      live_set_role: {
        Args: { _role: string; _room_id: string; _user_id: string }
        Returns: string
      }
      live_start_room: {
        Args: { _accept_rules: boolean; _subgroup_id: string; _title: string }
        Returns: string
      }
      live_status: { Args: never; Returns: Json }
      live_tidy: { Args: never; Returns: undefined }
      log_monetization_event: {
        Args: { _event: string; _metadata?: Json; _uid: string }
        Returns: undefined
      }
      looks_like_intro: { Args: { _text: string }; Returns: boolean }
      main_accounts_to_follow: {
        Args: never
        Returns: {
          id: string
        }[]
      }
      mark_conversation_read: {
        Args: { _conversation_id: string }
        Returns: number
      }
      mark_message_read: { Args: { _message_id: string }; Returns: undefined }
      mask_payment_secret: { Args: { _value: string }; Returns: string }
      member_email_enabled: { Args: { _key: string }; Returns: boolean }
      member_follow_list: {
        Args: {
          _kind: string
          _limit?: number
          _offset?: number
          _q?: string
          _user: string
        }
        Returns: {
          avatar_url: string
          display_name: string
          followed_at: string
          follows_me: boolean
          headline: string
          i_follow: boolean
          user_id: string
          username: string
        }[]
      }
      member_labels: {
        Args: { _ids: string[] }
        Returns: {
          level: number
          trusted: boolean
          user_id: string
        }[]
      }
      member_message_privacy: { Args: { _uid: string }; Returns: string }
      mod_decide: {
        Args: { _action: string; _report: string }
        Returns: string
      }
      mod_plain: { Args: { _html: string; _len?: number }; Returns: string }
      mod_queue: {
        Args: never
        Returns: {
          author_id: string
          author_name: string
          excerpt: string
          reason: string
          report_id: string
          reported_at: string
          reports_on_post: number
          target_id: string
          target_type: string
          thread_id: string
          title: string
        }[]
      }
      mod_recent_actions: {
        Args: { _limit?: number }
        Returns: {
          action: string
          created_at: string
          excerpt: string
          id: string
          moderator_id: string
          moderator_name: string
          target_id: string
          target_type: string
          thread_id: string
          undone_at: string
        }[]
      }
      mod_undo: { Args: { _action: string }; Returns: undefined }
      my_birthday_wishes: { Args: never; Returns: Json }
      my_community_submissions: {
        Args: never
        Returns: {
          created_at: string
          id: string
          kind: string
          review_note: string
          status: string
          title: string
        }[]
      }
      my_following_ids: { Args: never; Returns: string[] }
      my_invite: { Args: never; Returns: Json }
      my_thread_ids: {
        Args: never
        Returns: {
          id: string
        }[]
      }
      my_volunteer_powers: { Args: never; Returns: Json }
      newcomer_funnel: { Args: { _days?: number }; Returns: Json }
      newsdesk_author_id: { Args: never; Returns: string }
      newsdesk_cleanup: { Args: never; Returns: number }
      newsdesk_notify_admins: { Args: { _waiting: number }; Returns: number }
      newsdesk_plan_today: { Args: never; Returns: Json }
      newsdesk_share_feed: {
        Args: never
        Returns: {
          banner_title: string
          banner_url: string
          content: string
          thread_id: string
          title: string
        }[]
      }
      opportunities_board: {
        Args: { _kind?: string; _lga?: string; _limit?: number }
        Returns: {
          avatar_url: string
          business_name: string
          display_name: string
          headline: string
          lga: string
          looking_for: string
          occupation: string
          services: string
          updated_at: string
          user_id: string
          username: string
          work_experience: string
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
          donation_id: string | null
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
          user_id: string | null
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
      post_doing_well_note: {
        Args: { _thread: string; _what: string }
        Returns: undefined
      }
      post_question_of_the_day: { Args: never; Returns: string }
      posts_waiting_for_reply: {
        Args: { _limit?: number }
        Returns: {
          author_name: string
          created_at: string
          group_name: string
          id: string
          title: string
        }[]
      }
      premium_invite_claim: {
        Args: { _limit?: number }
        Returns: {
          email: string
          name: string
          token: string
          user_id: string
        }[]
      }
      premium_invite_opt_out: { Args: { _token: string }; Returns: boolean }
      prune_email_short_links: { Args: never; Returns: undefined }
      prune_issue_report_contact_emails: { Args: never; Returns: undefined }
      prune_search_rate_limits: { Args: never; Returns: undefined }
      publish_member_spotlight: {
        Args: {
          _about: string
          _headline: string
          _member: string
          _nomination?: string
          _quote?: string
        }
        Returns: string
      }
      queue_popular_threads_for_facebook: {
        Args: {
          _daily_cap?: number
          _min_replies?: number
          _min_upvotes?: number
        }
        Returns: number
      }
      redeem_subgroup_invite: { Args: { _token: string }; Returns: string }
      relationship_plans_enabled: { Args: never; Returns: boolean }
      remove_follower: { Args: { _user: string }; Returns: boolean }
      remove_member_spotlight: { Args: { _id: string }; Returns: undefined }
      resolve_username_to_email: {
        Args: { _username: string }
        Returns: string
      }
      review_community_item: {
        Args: { _decision: string; _id: string; _kind: string; _note?: string }
        Returns: undefined
      }
      review_contest: {
        Args: { _approve: boolean; _contest: string; _note?: string }
        Returns: undefined
      }
      run_helper_replies: { Args: never; Returns: number }
      search_public_profiles: {
        Args: { _limit?: number; _term: string }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          username: string
        }[]
      }
      send_birthday_wish: {
        Args: { _message: string; _to: string }
        Returns: Json
      }
      send_daily_nudges: { Args: never; Returns: number }
      send_newcomer_nudges: { Args: never; Returns: number }
      set_best_answer: {
        Args: { _reply: string; _thread: string }
        Returns: undefined
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
      set_share_birthday: { Args: { _on: boolean }; Returns: boolean }
      share_thread_to_facebook: {
        Args: { _thread_id: string }
        Returns: string
      }
      submit_community_event: {
        Args: {
          _description: string
          _ends?: string
          _lga?: string
          _link?: string
          _place?: string
          _starts: string
          _title: string
        }
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
      submit_spotlight_nomination: {
        Args: { _reason: string; _username: string }
        Returns: string
      }
      submit_success_story: {
        Args: { _person?: string; _story: string; _tag: string; _title: string }
        Returns: string
      }
      support_appeal_claim: {
        Args: { _limit?: number }
        Returns: {
          email: string
          name: string
          token: string
          user_id: string
        }[]
      }
      support_appeal_opt_out: { Args: { _token: string }; Returns: boolean }
      sync_reputation: { Args: { _user: string }; Returns: undefined }
      thread_community_state: { Args: { _thread: string }; Returns: Json }
      thread_share_path: { Args: { _thread_id: string }; Returns: string }
      toggle_thread_follow: { Args: { _thread: string }; Returns: boolean }
      track_monetization_event: {
        Args: { _event: string; _metadata?: Json }
        Returns: undefined
      }
      unanswered_member_threads: {
        Args: { _since: string }
        Returns: {
          author_id: string
          created_at: string
          id: string
          is_anonymous: boolean
          subgroup_id: string
          title: string
        }[]
      }
      verify_cron_token: { Args: { _token: string }; Returns: boolean }
      volunteer_decide: {
        Args: { _admin: string; _decision: string; _id: string; _note?: string }
        Returns: {
          admin_note: string | null
          answers: Json
          created_at: string
          decision_emailed_at: string | null
          email: string
          experience: string
          full_name: string
          hours_per_week: string
          id: string
          lga: string | null
          links: string | null
          location: string
          motivation: string
          phone: string | null
          powers_granted_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          role: string
          status: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "volunteer_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      volunteer_submit: {
        Args: {
          _answers: Json
          _email: string
          _experience: string
          _full_name: string
          _hours_per_week: string
          _lga: string
          _links: string
          _location: string
          _motivation: string
          _phone: string
          _role: string
          _user?: string
        }
        Returns: string
      }
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
