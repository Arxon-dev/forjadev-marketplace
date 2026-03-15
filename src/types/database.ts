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
      products: {
        Row: {
          id: string;
          vendor_id: string;
          category_id: string | null;
          title: string;
          slug: string;
          short_description: string | null;
          description: string | null;
          price_cents: number;
          currency: string;
          is_free: boolean;
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
          title: string;
          slug: string;
          short_description?: string | null;
          description?: string | null;
          price_cents?: number;
          currency?: string;
          is_free?: boolean;
          moderation_status?: "draft" | "pending" | "approved" | "rejected" | "hidden";
          rejection_reason?: string | null;
          compatibility?: string | null;
          featured_image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string | null;
          title?: string;
          slug?: string;
          short_description?: string | null;
          description?: string | null;
          price_cents?: number;
          currency?: string;
          is_free?: boolean;
          moderation_status?: "draft" | "pending" | "approved" | "rejected" | "hidden";
          rejection_reason?: string | null;
          compatibility?: string | null;
          featured_image_url?: string | null;
          updated_at?: string;
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
    };
  };
}
