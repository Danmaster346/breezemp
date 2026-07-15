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
      admin_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          icon: string | null
          icon_url: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          icon?: string | null
          icon_url?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          icon?: string | null
          icon_url?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          body: string | null
          chat_id: string
          created_at: string
          id: string
          image_path: string | null
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body?: string | null
          chat_id: string
          created_at?: string
          id?: string
          image_path?: string | null
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string | null
          chat_id?: string
          created_at?: string
          id?: string
          image_path?: string | null
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          last_message_at: string
          order_id: string | null
          product_id: string | null
          seller_id: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          last_message_at?: string
          order_id?: string | null
          product_id?: string | null
          seller_id: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          last_message_at?: string
          order_id?: string | null
          product_id?: string | null
          seller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chats_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          commission_kopecks: number
          id: string
          image_url: string | null
          order_id: string
          price_kopecks: number
          product_id: string | null
          quantity: number
          received_at: string | null
          return_admin_reason: string | null
          return_admin_status: string
          return_comment: string | null
          return_photos: string[] | null
          return_reason: string | null
          returned_at: string | null
          seller_id: string
          shipped_at: string | null
          shipping_carrier: string | null
          status: string
          title_snapshot: string
          tracking_number: string | null
        }
        Insert: {
          commission_kopecks: number
          id?: string
          image_url?: string | null
          order_id: string
          price_kopecks: number
          product_id?: string | null
          quantity: number
          received_at?: string | null
          return_admin_reason?: string | null
          return_admin_status?: string
          return_comment?: string | null
          return_photos?: string[] | null
          return_reason?: string | null
          returned_at?: string | null
          seller_id: string
          shipped_at?: string | null
          shipping_carrier?: string | null
          status?: string
          title_snapshot: string
          tracking_number?: string | null
        }
        Update: {
          commission_kopecks?: number
          id?: string
          image_url?: string | null
          order_id?: string
          price_kopecks?: number
          product_id?: string | null
          quantity?: number
          received_at?: string | null
          return_admin_reason?: string | null
          return_admin_status?: string
          return_comment?: string | null
          return_photos?: string[] | null
          return_reason?: string | null
          returned_at?: string | null
          seller_id?: string
          shipped_at?: string | null
          shipping_carrier?: string | null
          status?: string
          title_snapshot?: string
          tracking_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_id: string
          commission_kopecks: number
          created_at: string
          discount_kopecks: number
          id: string
          promo_code: string | null
          shipping_address: string
          shipping_cost_kopecks: number
          shipping_method: string
          shipping_name: string
          shipping_phone: string
          status: string
          total_kopecks: number
        }
        Insert: {
          buyer_id: string
          commission_kopecks: number
          created_at?: string
          discount_kopecks?: number
          id?: string
          promo_code?: string | null
          shipping_address: string
          shipping_cost_kopecks?: number
          shipping_method?: string
          shipping_name: string
          shipping_phone: string
          status?: string
          total_kopecks: number
        }
        Update: {
          buyer_id?: string
          commission_kopecks?: number
          created_at?: string
          discount_kopecks?: number
          id?: string
          promo_code?: string | null
          shipping_address?: string
          shipping_cost_kopecks?: number
          shipping_method?: string
          shipping_name?: string
          shipping_phone?: string
          status?: string
          total_kopecks?: number
        }
        Relationships: []
      }
      payouts: {
        Row: {
          amount_kopecks: number
          created_at: string
          id: string
          seller_id: string
          status: string
        }
        Insert: {
          amount_kopecks: number
          created_at?: string
          id?: string
          seller_id: string
          status?: string
        }
        Update: {
          amount_kopecks?: number
          created_at?: string
          id?: string
          seller_id?: string
          status?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          image_urls: string[]
          is_active: boolean
          moderated_at: string | null
          moderated_by: string | null
          moderation_reason: string | null
          moderation_status: string
          price_kopecks: number
          seller_id: string
          stock: number
          title: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[]
          is_active?: boolean
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          moderation_status?: string
          price_kopecks: number
          seller_id: string
          stock?: number
          title: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[]
          is_active?: boolean
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          moderation_status?: string
          price_kopecks?: number
          seller_id?: string
          stock?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          blocked_reason: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_blocked: boolean
          phone: string | null
        }
        Insert: {
          blocked_reason?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_blocked?: boolean
          phone?: string | null
        }
        Update: {
          blocked_reason?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_blocked?: boolean
          phone?: string | null
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          max_uses: number | null
          min_order_kopecks: number
          updated_at: string
          used_count: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_order_kopecks?: number
          updated_at?: string
          used_count?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_order_kopecks?: number
          updated_at?: string
          used_count?: number
        }
        Relationships: []
      }
      reviews: {
        Row: {
          author_name: string | null
          comment: string | null
          created_at: string
          id: string
          is_hidden: boolean
          order_item_id: string
          photos: string[]
          product_id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          author_name?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          is_hidden?: boolean
          order_item_id: string
          photos?: string[]
          product_id: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          author_name?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          is_hidden?: boolean
          order_item_id?: string
          photos?: string[]
          product_id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_profiles: {
        Row: {
          badges: string[]
          created_at: string
          email: string | null
          full_description: string | null
          instagram: string | null
          logo_path: string | null
          other_social: string | null
          phone: string | null
          shop_name: string | null
          short_description: string | null
          telegram: string | null
          updated_at: string
          user_id: string
          vk: string | null
          whatsapp: string | null
        }
        Insert: {
          badges?: string[]
          created_at?: string
          email?: string | null
          full_description?: string | null
          instagram?: string | null
          logo_path?: string | null
          other_social?: string | null
          phone?: string | null
          shop_name?: string | null
          short_description?: string | null
          telegram?: string | null
          updated_at?: string
          user_id: string
          vk?: string | null
          whatsapp?: string | null
        }
        Update: {
          badges?: string[]
          created_at?: string
          email?: string | null
          full_description?: string | null
          instagram?: string | null
          logo_path?: string | null
          other_social?: string | null
          phone?: string | null
          shop_name?: string | null
          short_description?: string | null
          telegram?: string | null
          updated_at?: string
          user_id?: string
          vk?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_promo_code: { Args: { _code: string }; Returns: boolean }
      decrement_product_stock: {
        Args: { _product_id: string; _qty: number }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_product_stock: {
        Args: { _product_id: string; _qty: number }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "buyer" | "seller" | "admin"
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
      app_role: ["buyer", "seller", "admin"],
    },
  },
} as const
