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
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          store_name: string;
          slug: string;
          bio?: string | null;
          created_at?: string;
        };
        Update: {
          store_name?: string;
          slug?: string;
          bio?: string | null;
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
    };
    Functions: {
      create_checkout_order: {
        Args: {
          p_product_id: string;
        };
        Returns: {
          order_id: string;
          license_key: string | null;
          license_issued: boolean;
          message: string;
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
    };
  };
}
