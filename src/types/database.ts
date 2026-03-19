export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          username: string | null;
          display_name: string | null;
          avatar_url: string | null;
          role: "buyer" | "seller" | "admin";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          username?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          role?: "buyer" | "seller" | "admin";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string | null;
          username?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          role?: "buyer" | "seller" | "admin";
          updated_at?: string;
        };
      };
      vendors: {
        Row: {
          id: string;
          user_id: string;
          store_name: string;
          slug: string;
          bio: string | null;
          discord_url: string | null;
          steam_url: string | null;
          x_url: string | null;
          website_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          store_name: string;
          slug: string;
          bio?: string | null;
          discord_url?: string | null;
          steam_url?: string | null;
          x_url?: string | null;
          website_url?: string | null;
          created_at?: string;
        };
        Update: {
          store_name?: string;
          slug?: string;
          bio?: string | null;
          discord_url?: string | null;
          steam_url?: string | null;
          x_url?: string | null;
          website_url?: string | null;
        };
      };
      seller_reputation_snapshots: {
        Row: {
          vendor_id: string;
          approved_products: number;
          free_products: number;
          paid_products: number;
          total_downloads: number;
          total_purchases: number;
          total_ratings: number;
          average_rating: number | null;
          joined_at: string;
          latest_product_update_at: string | null;
          reputation_score: number;
          updated_at: string;
        };
        Insert: {
          vendor_id: string;
          approved_products?: number;
          free_products?: number;
          paid_products?: number;
          total_downloads?: number;
          total_purchases?: number;
          total_ratings?: number;
          average_rating?: number | null;
          joined_at: string;
          latest_product_update_at?: string | null;
          reputation_score?: number;
          updated_at?: string;
        };
        Update: {
          approved_products?: number;
          free_products?: number;
          paid_products?: number;
          total_downloads?: number;
          total_purchases?: number;
          total_ratings?: number;
          average_rating?: number | null;
          joined_at?: string;
          latest_product_update_at?: string | null;
          reputation_score?: number;
          updated_at?: string;
        };
      };
      seller_badges: {
        Row: {
          id: string;
          vendor_id: string;
          code: string;
          label: string;
          tone: "primary" | "success" | "warning";
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          code: string;
          label: string;
          tone: "primary" | "success" | "warning";
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          code?: string;
          label?: string;
          tone?: "primary" | "success" | "warning";
          sort_order?: number;
        };
      };
      games: {
        Row: {
          id: string;
          name: string;
          slug: string;
          is_active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          is_active?: boolean;
          sort_order?: number;
        };
      };
      products: {
        Row: {
          id: string;
          vendor_id: string;
          category_id: string | null;
          game_id: string | null;
          title: string;
          slug: string;
          short_description: string | null;
          description: string | null;
          support_policy: string | null;
          refund_policy: string | null;
          update_policy: string | null;
          price_cents: number;
          currency: string;
          is_free: boolean;
          featured: boolean;
          search_text: string | null;
          view_count: number;
          download_count: number;
          purchase_count: number;
          rating_average: number;
          rating_count: number;
          moderation_status: "draft" | "pending" | "approved" | "rejected" | "hidden";
          rejection_reason?: string | null;
          compatibility: string | null;
          featured_image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          category_id?: string | null;
          game_id?: string | null;
          title: string;
          slug: string;
          short_description?: string | null;
          description?: string | null;
          support_policy?: string | null;
          refund_policy?: string | null;
          update_policy?: string | null;
          price_cents?: number;
          currency?: string;
          is_free?: boolean;
          featured?: boolean;
          search_text?: string | null;
          view_count?: number;
          download_count?: number;
          purchase_count?: number;
          rating_average?: number;
          rating_count?: number;
          moderation_status?: "draft" | "pending" | "approved" | "rejected" | "hidden";
          rejection_reason?: string | null;
          compatibility?: string | null;
          featured_image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string | null;
          game_id?: string | null;
          title?: string;
          slug?: string;
          short_description?: string | null;
          description?: string | null;
          support_policy?: string | null;
          refund_policy?: string | null;
          update_policy?: string | null;
          price_cents?: number;
          currency?: string;
          is_free?: boolean;
          featured?: boolean;
          search_text?: string | null;
          view_count?: number;
          download_count?: number;
          purchase_count?: number;
          rating_average?: number;
          rating_count?: number;
          moderation_status?: "draft" | "pending" | "approved" | "rejected" | "hidden";
          rejection_reason?: string | null;
          compatibility?: string | null;
          featured_image_url?: string | null;
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          parent_id: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          parent_id?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          description?: string | null;
          parent_id?: string | null;
          is_active?: boolean;
          sort_order?: number;
        };
      };
      product_categories: {
        Row: {
          product_id: string;
          category_id: string;
          created_at: string;
        };
        Insert: {
          product_id: string;
          category_id: string;
          created_at?: string;
        };
        Update: {
          category_id?: string;
        };
      };
      product_versions: {
        Row: {
          id: string;
          product_id: string;
          version: string;
          changelog: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          version: string;
          changelog?: string | null;
          created_at?: string;
        };
        Update: {
          version?: string;
          changelog?: string | null;
        };
      };
      product_faqs: {
        Row: {
          id: string;
          product_id: string;
          question: string;
          answer: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          question: string;
          answer: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          question?: string;
          answer?: string;
          sort_order?: number;
        };
      };
      product_guides: {
        Row: {
          id: string;
          product_id: string;
          title: string;
          body: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          title: string;
          body: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          title?: string;
          body?: string;
          sort_order?: number;
        };
      };
      product_files: {
        Row: {
          id: string;
          product_version_id: string;
          storage_path: string;
          file_name: string;
          file_size_bytes: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_version_id: string;
          storage_path: string;
          file_name: string;
          file_size_bytes?: number | null;
          created_at?: string;
        };
        Update: {
          storage_path?: string;
          file_name?: string;
          file_size_bytes?: number | null;
        };
      };
      reviews: {
        Row: {
          id: string;
          product_id: string;
          user_id: string;
          rating: number;
          title: string | null;
          body: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          user_id: string;
          rating: number;
          title?: string | null;
          body?: string | null;
          created_at?: string;
        };
        Update: {
          rating?: number;
          title?: string | null;
          body?: string | null;
        };
      };
      orders: {
        Row: {
          id: string;
          user_id: string;
          total_cents: number;
          currency: string;
          status: "pending" | "completed" | "failed" | "refunded";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          total_cents?: number;
          currency?: string;
          status?: "pending" | "completed" | "failed" | "refunded";
          created_at?: string;
        };
        Update: {
          total_cents?: number;
          currency?: string;
          status?: "pending" | "completed" | "failed" | "refunded";
        };
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          price_cents: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          price_cents?: number;
          created_at?: string;
        };
        Update: {
          price_cents?: number;
        };
      };
      downloads: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          downloaded_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id: string;
          downloaded_at?: string;
        };
        Update: {
          downloaded_at?: string;
        };
      };
      support_tickets: {
        Row: {
          id: string;
          product_id: string;
          vendor_id: string;
          buyer_user_id: string;
          subject: string;
          status: "open" | "waiting_seller" | "waiting_buyer" | "closed";
          priority: "normal" | "high";
          created_at: string;
          updated_at: string;
          last_message_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          vendor_id: string;
          buyer_user_id: string;
          subject: string;
          status?: "open" | "waiting_seller" | "waiting_buyer" | "closed";
          priority?: "normal" | "high";
          created_at?: string;
          updated_at?: string;
          last_message_at?: string;
        };
        Update: {
          subject?: string;
          status?: "open" | "waiting_seller" | "waiting_buyer" | "closed";
          priority?: "normal" | "high";
          updated_at?: string;
          last_message_at?: string;
        };
      };
      support_messages: {
        Row: {
          id: string;
          ticket_id: string;
          sender_user_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          sender_user_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          body?: string;
        };
      };
      product_discussions: {
        Row: {
          id: string;
          product_id: string;
          author_user_id: string;
          title: string;
          body: string;
          is_pinned: boolean;
          is_locked: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          author_user_id: string;
          title: string;
          body: string;
          is_pinned?: boolean;
          is_locked?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          body?: string;
          is_pinned?: boolean;
          is_locked?: boolean;
          updated_at?: string;
        };
      };
      discussion_messages: {
        Row: {
          id: string;
          discussion_id: string;
          author_user_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          discussion_id: string;
          author_user_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          body?: string;
        };
      };
      collections: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          slug: string;
          description: string | null;
          is_public: boolean;
          featured_image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          slug: string;
          description?: string | null;
          is_public?: boolean;
          featured_image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          slug?: string;
          description?: string | null;
          is_public?: boolean;
          featured_image_url?: string | null;
          updated_at?: string;
        };
      };
      collection_items: {
        Row: {
          id: string;
          collection_id: string;
          product_id: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          collection_id: string;
          product_id: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          sort_order?: number;
        };
      };
      user_provider_identities: {
        Row: {
          id: string;
          user_id: string;
          provider: "discord" | "steam";
          provider_user_id: string;
          provider_email: string | null;
          provider_username: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: "discord" | "steam";
          provider_user_id: string;
          provider_email?: string | null;
          provider_username?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          provider_email?: string | null;
          provider_username?: string | null;
          metadata?: Json | null;
          updated_at?: string;
        };
      };
      wishlists: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id: string;
          created_at?: string;
        };
        Update: {};
      };
      seller_followers: {
        Row: {
          id: string;
          user_id: string;
          vendor_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          vendor_id: string;
          created_at?: string;
        };
        Update: {};
      };
      coupons: {
        Row: {
          id: string;
          vendor_id: string;
          product_id: string;
          code: string;
          discount_type: "percent" | "fixed";
          discount_value: number;
          starts_at: string | null;
          ends_at: string | null;
          max_redemptions: number | null;
          redemption_count: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          product_id: string;
          code: string;
          discount_type: "percent" | "fixed";
          discount_value: number;
          starts_at?: string | null;
          ends_at?: string | null;
          max_redemptions?: number | null;
          redemption_count?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          code?: string;
          discount_type?: "percent" | "fixed";
          discount_value?: number;
          starts_at?: string | null;
          ends_at?: string | null;
          max_redemptions?: number | null;
          redemption_count?: number;
          is_active?: boolean;
        };
      };
      campaigns: {
        Row: {
          id: string;
          vendor_id: string;
          product_id: string | null;
          bundle_id: string | null;
          title: string;
          campaign_type: "flash_deal" | "launch_discount" | "featured_placement";
          discount_type: "percent" | "fixed" | null;
          discount_value: number | null;
          starts_at: string | null;
          ends_at: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          product_id?: string | null;
          bundle_id?: string | null;
          title: string;
          campaign_type: "flash_deal" | "launch_discount" | "featured_placement";
          discount_type?: "percent" | "fixed" | null;
          discount_value?: number | null;
          starts_at?: string | null;
          ends_at?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          campaign_type?: "flash_deal" | "launch_discount" | "featured_placement";
          discount_type?: "percent" | "fixed" | null;
          discount_value?: number | null;
          starts_at?: string | null;
          ends_at?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      bundles: {
        Row: {
          id: string;
          vendor_id: string;
          title: string;
          slug: string;
          short_description: string | null;
          description: string | null;
          featured_image_url: string | null;
          price_cents: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          title: string;
          slug: string;
          short_description?: string | null;
          description?: string | null;
          featured_image_url?: string | null;
          price_cents: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          slug?: string;
          short_description?: string | null;
          description?: string | null;
          featured_image_url?: string | null;
          price_cents?: number;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      bundle_products: {
        Row: {
          bundle_id: string;
          product_id: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          bundle_id: string;
          product_id: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          sort_order?: number;
        };
      };
      user_notifications: {
        Row: {
          id: string;
          recipient_user_id: string;
          actor_user_id: string | null;
          kind: string;
          title: string;
          body: string;
          href: string | null;
          entity_type: string | null;
          entity_id: string | null;
          metadata: Json | null;
          is_read: boolean;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipient_user_id: string;
          actor_user_id?: string | null;
          kind: string;
          title: string;
          body: string;
          href?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          metadata?: Json | null;
          is_read?: boolean;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          kind?: string;
          title?: string;
          body?: string;
          href?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          metadata?: Json | null;
          is_read?: boolean;
          read_at?: string | null;
        };
      };
      risk_events: {
        Row: {
          id: string;
          entity_type: string;
          entity_id: string;
          vendor_id: string | null;
          user_id: string | null;
          severity: "low" | "medium" | "high";
          code: string;
          title: string;
          details: string | null;
          status: "open" | "resolved" | "ignored";
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          entity_type: string;
          entity_id: string;
          vendor_id?: string | null;
          user_id?: string | null;
          severity: "low" | "medium" | "high";
          code: string;
          title: string;
          details?: string | null;
          status?: "open" | "resolved" | "ignored";
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          severity?: "low" | "medium" | "high";
          code?: string;
          title?: string;
          details?: string | null;
          status?: "open" | "resolved" | "ignored";
          resolved_at?: string | null;
        };
      };
      moderation_flags: {
        Row: {
          id: string;
          product_id: string;
          flag_code: string;
          severity: "low" | "medium" | "high";
          reason: string;
          is_active: boolean;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          product_id: string;
          flag_code: string;
          severity: "low" | "medium" | "high";
          reason: string;
          is_active?: boolean;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          severity?: "low" | "medium" | "high";
          reason?: string;
          is_active?: boolean;
          resolved_at?: string | null;
        };
      };
      license_anomalies: {
        Row: {
          id: string;
          license_id: string | null;
          product_id: string;
          user_id: string;
          anomaly_code: string;
          severity: "low" | "medium" | "high";
          details: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          license_id?: string | null;
          product_id: string;
          user_id: string;
          anomaly_code: string;
          severity: "low" | "medium" | "high";
          details?: string | null;
          created_at?: string;
        };
        Update: {
          anomaly_code?: string;
          severity?: "low" | "medium" | "high";
          details?: string | null;
        };
      };
      disputes: {
        Row: {
          id: string;
          order_id: string | null;
          license_id: string | null;
          product_id: string | null;
          opened_by_user_id: string;
          assigned_admin_user_id: string | null;
          status: "open" | "reviewing" | "resolved" | "rejected";
          reason: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id?: string | null;
          license_id?: string | null;
          product_id?: string | null;
          opened_by_user_id: string;
          assigned_admin_user_id?: string | null;
          status?: "open" | "reviewing" | "resolved" | "rejected";
          reason: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          assigned_admin_user_id?: string | null;
          status?: "open" | "reviewing" | "resolved" | "rejected";
          reason?: string;
          updated_at?: string;
        };
      };
      product_risk_snapshots: {
        Row: {
          product_id: string;
          vendor_id: string;
          moderation_flag_count: number;
          open_risk_event_count: number;
          high_risk_event_count: number;
          license_anomaly_count: number;
          open_dispute_count: number;
          risk_score: number;
          updated_at: string;
        };
        Insert: {
          product_id: string;
          vendor_id: string;
          moderation_flag_count?: number;
          open_risk_event_count?: number;
          high_risk_event_count?: number;
          license_anomaly_count?: number;
          open_dispute_count?: number;
          risk_score?: number;
          updated_at?: string;
        };
        Update: {
          vendor_id?: string;
          moderation_flag_count?: number;
          open_risk_event_count?: number;
          high_risk_event_count?: number;
          license_anomaly_count?: number;
          open_dispute_count?: number;
          risk_score?: number;
          updated_at?: string;
        };
      };
      seller_risk_snapshots: {
        Row: {
          vendor_id: string;
          product_count: number;
          flagged_product_count: number;
          open_risk_event_count: number;
          high_risk_event_count: number;
          license_anomaly_count: number;
          open_dispute_count: number;
          risk_score: number;
          updated_at: string;
        };
        Insert: {
          vendor_id: string;
          product_count?: number;
          flagged_product_count?: number;
          open_risk_event_count?: number;
          high_risk_event_count?: number;
          license_anomaly_count?: number;
          open_dispute_count?: number;
          risk_score?: number;
          updated_at?: string;
        };
        Update: {
          product_count?: number;
          flagged_product_count?: number;
          open_risk_event_count?: number;
          high_risk_event_count?: number;
          license_anomaly_count?: number;
          open_dispute_count?: number;
          risk_score?: number;
          updated_at?: string;
        };
      };
      licenses: {
        Row: {
          id: string;
          order_item_id: string;
          product_id: string;
          user_id: string;
          license_key: string;
          status: "active" | "revoked";
          issued_at: string;
          last_validated_at: string | null;
        };
        Insert: {
          id?: string;
          order_item_id: string;
          product_id: string;
          user_id: string;
          license_key: string;
          status?: "active" | "revoked";
          issued_at?: string;
          last_validated_at?: string | null;
        };
        Update: {
          license_key?: string;
          status?: "active" | "revoked";
          last_validated_at?: string | null;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          actor_user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          metadata?: Json | null;
        };
      };
      marketplace_events: {
        Row: {
          id: string;
          actor_user_id: string | null;
          session_id: string;
          event_name: string;
          page_type: string;
          entity_type: string | null;
          entity_id: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_user_id?: string | null;
          session_id: string;
          event_name: string;
          page_type: string;
          entity_type?: string | null;
          entity_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          metadata?: Json | null;
        };
      };
      product_analytics_daily: {
        Row: {
          product_id: string;
          vendor_id: string;
          day: string;
          view_count: number;
          click_count: number;
          add_to_cart_count: number;
          purchase_count: number;
          download_count: number;
          revenue_cents: number;
          updated_at: string;
        };
        Insert: {
          product_id: string;
          vendor_id: string;
          day: string;
          view_count?: number;
          click_count?: number;
          add_to_cart_count?: number;
          purchase_count?: number;
          download_count?: number;
          revenue_cents?: number;
          updated_at?: string;
        };
        Update: {
          view_count?: number;
          click_count?: number;
          add_to_cart_count?: number;
          purchase_count?: number;
          download_count?: number;
          revenue_cents?: number;
          updated_at?: string;
        };
      };
    };
    Functions: {
      create_checkout_order: {
        Args: {
          p_product_id: string;
          p_coupon_code?: string | null;
        };
        Returns: {
          order_id: string;
          license_key: string | null;
          license_issued: boolean;
          message: string;
          coupon_code: string | null;
          discount_cents: number;
          total_cents: number;
        }[];
      };
      create_bundle_checkout_order: {
        Args: {
          p_bundle_id: string;
        };
        Returns: {
          order_id: string;
          licenses_issued: number;
          message: string;
          total_cents: number;
          item_count: number;
          campaign_id: string | null;
          discount_cents: number;
        }[];
      };
      ensure_profile_exists: {
        Args: {
          p_user_id?: string;
        };
        Returns: string;
      };
      refresh_seller_badges: {
        Args: {
          p_vendor_id?: string | null;
        };
        Returns: void;
      };
      refresh_seller_reputation_snapshot: {
        Args: {
          p_vendor_id?: string | null;
        };
        Returns: void;
      };
      refresh_seller_trust: {
        Args: {
          p_vendor_id?: string | null;
        };
        Returns: void;
      };
      refresh_product_metrics: {
        Args: {
          p_product_id?: string | null;
        };
        Returns: void;
      };
      refresh_product_and_seller_metrics: {
        Args: {
          p_product_id: string;
        };
        Returns: void;
      };
      refresh_product_risk_snapshot: {
        Args: {
          p_product_id?: string | null;
        };
        Returns: void;
      };
      refresh_seller_risk_snapshot: {
        Args: {
          p_vendor_id?: string | null;
        };
        Returns: void;
      };
      refresh_product_and_seller_risk: {
        Args: {
          p_product_id?: string | null;
        };
        Returns: void;
      };
      refresh_product_analytics_daily: {
        Args: {
          p_day?: string;
          p_product_id?: string | null;
        };
        Returns: void;
      };
      refresh_recent_product_analytics_window: {
        Args: {
          p_days?: number;
        };
        Returns: void;
      };
      sync_user_provider_identities: {
        Args: {
          p_user_id?: string;
        };
        Returns: number;
      };
    };
  };
}
