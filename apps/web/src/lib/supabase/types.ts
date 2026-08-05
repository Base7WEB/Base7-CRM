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
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      admin_alert_queue: {
        Row: {
          created_at: string
          id: string
          notified: boolean
          payload: Json
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          notified?: boolean
          payload?: Json
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          notified?: boolean
          payload?: Json
          type?: string
        }
        Relationships: []
      }
      admin_notification_settings: {
        Row: {
          daily_summary_time: string
          digest_interval_minutes: number
          id: number
          last_daily_summary_sent_on: string | null
          last_digest_sent_at: string | null
          last_monthly_summary_sent_on: string | null
          last_weekly_summary_sent_on: string | null
          monthly_summary_rule: string
          monthly_summary_time: string
          notification_group_jid: string | null
          updated_at: string
          weekly_summary_time: string
          weekly_summary_weekday: number
        }
        Insert: {
          daily_summary_time?: string
          digest_interval_minutes?: number
          id?: number
          last_daily_summary_sent_on?: string | null
          last_digest_sent_at?: string | null
          last_monthly_summary_sent_on?: string | null
          last_weekly_summary_sent_on?: string | null
          monthly_summary_rule?: string
          monthly_summary_time?: string
          notification_group_jid?: string | null
          updated_at?: string
          weekly_summary_time?: string
          weekly_summary_weekday?: number
        }
        Update: {
          daily_summary_time?: string
          digest_interval_minutes?: number
          id?: number
          last_daily_summary_sent_on?: string | null
          last_digest_sent_at?: string | null
          last_monthly_summary_sent_on?: string | null
          last_weekly_summary_sent_on?: string | null
          monthly_summary_rule?: string
          monthly_summary_time?: string
          notification_group_jid?: string | null
          updated_at?: string
          weekly_summary_time?: string
          weekly_summary_weekday?: number
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_followups: {
        Row: {
          campaign_id: string
          created_at: string
          dias: number
          id: string
          ordem: number
          texto: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          dias: number
          id?: string
          ordem?: number
          texto: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          dias?: number
          id?: string
          ordem?: number
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_followups_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_leads: {
        Row: {
          campaign_id: string
          created_at: string
          followups_enviados: number
          id: string
          lead_id: string
          outbox_message_id: string | null
          simulado: boolean
          status: string
          ultimo_envio_em: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          followups_enviados?: number
          id?: string
          lead_id: string
          outbox_message_id?: string | null
          simulado?: boolean
          status?: string
          ultimo_envio_em?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          followups_enviados?: number
          id?: string
          lead_id?: string
          outbox_message_id?: string | null
          simulado?: boolean
          status?: string
          ultimo_envio_em?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_leads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "conversas_recentes"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "campaign_leads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_leads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_parados"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "campaign_leads_outbox_message_id_fkey"
            columns: ["outbox_message_id"]
            isOneToOne: false
            referencedRelation: "outbox_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          cidade: string | null
          corpo_mensagem: string
          created_at: string
          created_by: string | null
          descricao: string
          id: string
          intervalo_max_seg: number
          intervalo_min_seg: number
          limite_campanha: number | null
          limite_diario: number
          modo_conservador: boolean
          modo_teste: boolean
          nicho: string | null
          nome: string
          status: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          corpo_mensagem: string
          created_at?: string
          created_by?: string | null
          descricao?: string
          id?: string
          intervalo_max_seg?: number
          intervalo_min_seg?: number
          limite_campanha?: number | null
          limite_diario?: number
          modo_conservador?: boolean
          modo_teste?: boolean
          nicho?: string | null
          nome: string
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          corpo_mensagem?: string
          created_at?: string
          created_by?: string | null
          descricao?: string
          id?: string
          intervalo_max_seg?: number
          intervalo_min_seg?: number
          limite_campanha?: number | null
          limite_diario?: number
          modo_conservador?: boolean
          modo_teste?: boolean
          nicho?: string | null
          nome?: string
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consultant_agent_tokens: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultant_agent_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_events: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          lead_id: string
          payload: Json
          type: string
          whatsapp_message_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          lead_id: string
          payload?: Json
          type: string
          whatsapp_message_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          payload?: Json
          type?: string
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "conversas_recentes"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_parados"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      lead_tasks: {
        Row: {
          created_at: string
          feita: boolean
          id: string
          lead_id: string
          prazo: string | null
          texto: string
        }
        Insert: {
          created_at?: string
          feita?: boolean
          id?: string
          lead_id: string
          prazo?: string | null
          texto: string
        }
        Update: {
          created_at?: string
          feita?: boolean
          id?: string
          lead_id?: string
          prazo?: string | null
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "conversas_recentes"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_parados"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      leads: {
        Row: {
          atencao_necessaria: boolean
          cidade: string | null
          classificacao: string
          contato_nome: string | null
          created_at: string
          email: string | null
          empresa: string
          id: string
          instagram: string | null
          intencao_atual: string | null
          last_interaction_at: string | null
          legacy_id: string | null
          nicho: string | null
          origem: string
          rating_google: number | null
          responsavel_id: string | null
          responsavel_legado_texto: string | null
          reviews_google: number | null
          score: number
          site: string | null
          status: string
          tags: string[]
          telefone: string
          temperatura: string | null
          updated_at: string
        }
        Insert: {
          atencao_necessaria?: boolean
          cidade?: string | null
          classificacao?: string
          contato_nome?: string | null
          created_at?: string
          email?: string | null
          empresa: string
          id?: string
          instagram?: string | null
          intencao_atual?: string | null
          last_interaction_at?: string | null
          legacy_id?: string | null
          nicho?: string | null
          origem?: string
          rating_google?: number | null
          responsavel_id?: string | null
          responsavel_legado_texto?: string | null
          reviews_google?: number | null
          score?: number
          site?: string | null
          status?: string
          tags?: string[]
          telefone: string
          temperatura?: string | null
          updated_at?: string
        }
        Update: {
          atencao_necessaria?: boolean
          cidade?: string | null
          classificacao?: string
          contato_nome?: string | null
          created_at?: string
          email?: string | null
          empresa?: string
          id?: string
          instagram?: string | null
          intencao_atual?: string | null
          last_interaction_at?: string | null
          legacy_id?: string | null
          nicho?: string | null
          origem?: string
          rating_google?: number | null
          responsavel_id?: string | null
          responsavel_legado_texto?: string | null
          reviews_google?: number | null
          score?: number
          site?: string | null
          status?: string
          tags?: string[]
          telefone?: string
          temperatura?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          stage: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          stage: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          stage?: string
          title?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          direction: string
          id: string
          lead_id: string
          sent_by: string | null
          whatsapp_message_id: string
        }
        Insert: {
          body: string
          created_at?: string
          direction: string
          id?: string
          lead_id: string
          sent_by?: string | null
          whatsapp_message_id: string
        }
        Update: {
          body?: string
          created_at?: string
          direction?: string
          id?: string
          lead_id?: string
          sent_by?: string | null
          whatsapp_message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "conversas_recentes"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_parados"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "messages_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      outbox_messages: {
        Row: {
          attempt_count: number
          body: string
          campaign_id: string | null
          created_at: string
          error: string | null
          id: string
          lead_id: string | null
          not_before: string | null
          profile_id: string
          sent_at: string | null
          status: string
          to_phone: string
          whatsapp_message_id: string | null
        }
        Insert: {
          attempt_count?: number
          body: string
          campaign_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          lead_id?: string | null
          not_before?: string | null
          profile_id: string
          sent_at?: string | null
          status?: string
          to_phone: string
          whatsapp_message_id?: string | null
        }
        Update: {
          attempt_count?: number
          body?: string
          campaign_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          lead_id?: string | null
          not_before?: string | null
          profile_id?: string
          sent_at?: string | null
          status?: string
          to_phone?: string
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbox_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbox_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "conversas_recentes"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "outbox_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbox_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_parados"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "outbox_messages_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          is_active?: boolean
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      scraper_job_leads: {
        Row: {
          cidade: string | null
          created_at: string
          email: string | null
          empresa: string
          endereco: string | null
          id: string
          importado: boolean
          instagram: string | null
          job_id: string
          lead_id: string | null
          nicho: string | null
          rating_google: number | null
          responsavel_atual: string | null
          reviews_google: number | null
          site: string | null
          telefone: string | null
        }
        Insert: {
          cidade?: string | null
          created_at?: string
          email?: string | null
          empresa: string
          endereco?: string | null
          id?: string
          importado?: boolean
          instagram?: string | null
          job_id: string
          lead_id?: string | null
          nicho?: string | null
          rating_google?: number | null
          responsavel_atual?: string | null
          reviews_google?: number | null
          site?: string | null
          telefone?: string | null
        }
        Update: {
          cidade?: string | null
          created_at?: string
          email?: string | null
          empresa?: string
          endereco?: string | null
          id?: string
          importado?: boolean
          instagram?: string | null
          job_id?: string
          lead_id?: string | null
          nicho?: string | null
          rating_google?: number | null
          responsavel_atual?: string | null
          reviews_google?: number | null
          site?: string | null
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scraper_job_leads_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "scraper_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scraper_job_leads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      scraper_jobs: {
        Row: {
          created_at: string
          erro: string | null
          finished_at: string | null
          id: string
          modo: string
          params: Json
          requested_by: string
          started_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          erro?: string | null
          finished_at?: string | null
          id?: string
          modo: string
          params?: Json
          requested_by: string
          started_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          erro?: string | null
          finished_at?: string | null
          id?: string
          modo?: string
          params?: Json
          requested_by?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "scraper_jobs_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_sessions: {
        Row: {
          last_connected_at: string | null
          last_disconnected_at: string | null
          profile_id: string
          status: string
          updated_at: string
        }
        Insert: {
          last_connected_at?: string | null
          last_disconnected_at?: string | null
          profile_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          last_connected_at?: string | null
          last_disconnected_at?: string | null
          profile_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      conversas_recentes: {
        Row: {
          classificacao: string | null
          empresa: string | null
          lead_id: string | null
          responsavel_id: string | null
          status: string | null
          telefone: string | null
          ultima_direcao: string | null
          ultima_mensagem: string | null
          ultima_mensagem_em: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_parados: {
        Row: {
          empresa: string | null
          lead_id: string | null
          motivo: string | null
          responsavel_id: string | null
          status: string | null
          ultima_direcao: string | null
          ultima_mensagem_em: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      is_active_user: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
