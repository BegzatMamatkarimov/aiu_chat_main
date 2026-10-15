// Типы БД ведутся вручную по supabase/migrations/*.sql в формате `supabase gen types typescript`.
// При изменении схемы (таблицы, RPC) обновляйте этот файл.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          display_name: string
          avatar_url: string | null
          course: number | null
          major: string | null
          locale: string
          created_at: string
        }
        Insert: {
          id: string
          username?: string | null
          display_name?: string
          avatar_url?: string | null
          course?: number | null
          major?: string | null
          locale?: string
          created_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          display_name?: string
          avatar_url?: string | null
          course?: number | null
          major?: string | null
          locale?: string
          created_at?: string
        }
        Relationships: []
      }
      chats: {
        Row: {
          id: string
          type: string
          name: string | null
          description: string | null
          avatar_url: string | null
          is_public: boolean
          invite_code: string
          created_by: string | null
          created_at: string
          last_message_at: string
        }
        Insert: {
          id?: string
          type: string
          name?: string | null
          description?: string | null
          avatar_url?: string | null
          is_public?: boolean
          invite_code?: string
          created_by?: string | null
          created_at?: string
          last_message_at?: string
        }
        Update: {
          id?: string
          type?: string
          name?: string | null
          description?: string | null
          avatar_url?: string | null
          is_public?: boolean
          invite_code?: string
          created_by?: string | null
          created_at?: string
          last_message_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chats_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_members: {
        Row: {
          chat_id: string
          user_id: string
          role: string
          joined_at: string
          last_read_at: string
        }
        Insert: {
          chat_id: string
          user_id: string
          role?: string
          joined_at?: string
          last_read_at?: string
        }
        Update: {
          chat_id?: string
          user_id?: string
          role?: string
          joined_at?: string
          last_read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_members_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          id: string
          chat_id: string
          sender_id: string | null
          body: string | null
          reply_to: string | null
          created_at: string
          deleted_at: string | null
        }
        Insert: {
          id: string
          chat_id: string
          sender_id?: string | null
          body?: string | null
          reply_to?: string | null
          created_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          chat_id?: string
          sender_id?: string | null
          body?: string | null
          reply_to?: string | null
          created_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          id: string
          message_id: string
          chat_id: string
          kind: string
          storage_path: string
          mime: string
          size_bytes: number
          width: number | null
          height: number | null
          duration_ms: number | null
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          chat_id: string
          kind: string
          storage_path: string
          mime: string
          size_bytes: number
          width?: number | null
          height?: number | null
          duration_ms?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          chat_id?: string
          kind?: string
          storage_path?: string
          mime?: string
          size_bytes?: number
          width?: number | null
          height?: number | null
          duration_ms?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          message_id: string
          chat_id: string
          user_id: string
          emoji: string
          created_at: string
        }
        Insert: {
          message_id: string
          chat_id: string
          user_id: string
          emoji: string
          created_at?: string
        }
        Update: {
          message_id?: string
          chat_id?: string
          user_id?: string
          emoji?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_pairs: {
        Row: {
          user_a: string
          user_b: string
          chat_id: string
        }
        Insert: {
          user_a: string
          user_b: string
          chat_id: string
        }
        Update: {
          user_a?: string
          user_b?: string
          chat_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_pairs_user_a_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_pairs_user_b_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_pairs_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: true
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_group: {
        Args: { p_name: string; p_description?: string | null; p_is_public?: boolean }
        Returns: Database['public']['Tables']['chats']['Row']
      }
      delete_message: {
        Args: { p_id: string }
        Returns: undefined
      }
      get_group_by_code: {
        Args: { p_code: string }
        Returns: {
          id: string
          name: string
          description: string | null
          avatar_url: string | null
          member_count: number
          is_member: boolean
        }[]
      }
      get_or_create_direct_chat: {
        Args: { p_other: string }
        Returns: string
      }
      join_chat_by_code: {
        Args: { p_code: string }
        Returns: string
      }
      leave_chat: {
        Args: { p_chat_id: string }
        Returns: undefined
      }
      list_my_chats: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          type: string
          name: string | null
          avatar_url: string | null
          last_message_at: string
          last_message: Json
          unread_count: number
          role: string
          peer: Json
        }[]
      }
      mark_read: {
        Args: { p_chat_id: string }
        Returns: undefined
      }
      search_public_groups: {
        Args: { p_query?: string; p_limit?: number }
        Returns: {
          id: string
          name: string
          description: string | null
          avatar_url: string | null
          invite_code: string
          member_count: number
          is_member: boolean
        }[]
      }
      send_message: {
        Args: {
          p_id: string
          p_chat_id: string
          p_body?: string | null
          p_reply_to?: string | null
          p_attachments?: Json
        }
        Returns: Json
      }
      toggle_reaction: {
        Args: { p_message_id: string; p_emoji: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
