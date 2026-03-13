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
          compatibility: string | null;
          featured_image_url: string | null;
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
}
