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
      diagnosis_categories: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      exams: {
        Row: {
          created_at: string
          data: string | null
          id: string
          patient_id: string
          resultado: string | null
          status: Database["public"]["Enums"]["exame_status"]
          tipo: Database["public"]["Enums"]["exame_tipo"]
        }
        Insert: {
          created_at?: string
          data?: string | null
          id?: string
          patient_id: string
          resultado?: string | null
          status?: Database["public"]["Enums"]["exame_status"]
          tipo: Database["public"]["Enums"]["exame_tipo"]
        }
        Update: {
          created_at?: string
          data?: string | null
          id?: string
          patient_id?: string
          resultado?: string | null
          status?: Database["public"]["Enums"]["exame_status"]
          tipo?: Database["public"]["Enums"]["exame_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "exams_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      neuro_regions: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      patient_diagnoses: {
        Row: {
          diagnosis_id: string
          patient_id: string
        }
        Insert: {
          diagnosis_id: string
          patient_id: string
        }
        Update: {
          diagnosis_id?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_diagnoses_diagnosis_id_fkey"
            columns: ["diagnosis_id"]
            isOneToOne: false
            referencedRelation: "diagnosis_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_diagnoses_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_main_suspicions: {
        Row: {
          diagnosis_id: string
          patient_id: string
        }
        Insert: {
          diagnosis_id: string
          patient_id: string
        }
        Update: {
          diagnosis_id?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_main_suspicions_diagnosis_id_fkey"
            columns: ["diagnosis_id"]
            isOneToOne: false
            referencedRelation: "diagnosis_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_main_suspicions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_regions: {
        Row: {
          patient_id: string
          region_id: string
        }
        Insert: {
          patient_id: string
          region_id: string
        }
        Update: {
          patient_id?: string
          region_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_regions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_regions_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "neuro_regions"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_suspicions: {
        Row: {
          patient_id: string
          suspicion_id: string
        }
        Insert: {
          patient_id: string
          suspicion_id: string
        }
        Update: {
          patient_id?: string
          suspicion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_suspicions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_suspicions_suspicion_id_fkey"
            columns: ["suspicion_id"]
            isOneToOne: false
            referencedRelation: "suspicion_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          codigo: string | null
          codigo_publicacao: string
          created_at: string
          created_by: string | null
          data_atendimento: string | null
          data_desfecho: string | null
          desfecho: Database["public"]["Enums"]["desfecho"] | null
          diagnostico_importado_texto: string | null
          diagnostico_texto_livre: string | null
          especie: string | null
          esterilizacao: string | null
          id: string
          idade_meses: number | null
          idade_texto: string | null
          neurolocalizacao_texto: string | null
          paciente: string
          raca: string | null
          sexo: string | null
          status_diagnostico: Database["public"]["Enums"]["status_diagnostico"]
          suspeitas_texto: string | null
          tutor: string | null
          updated_at: string
          vivo_morto: string | null
        }
        Insert: {
          codigo?: string | null
          codigo_publicacao?: string
          created_at?: string
          created_by?: string | null
          data_atendimento?: string | null
          data_desfecho?: string | null
          desfecho?: Database["public"]["Enums"]["desfecho"] | null
          diagnostico_importado_texto?: string | null
          diagnostico_texto_livre?: string | null
          especie?: string | null
          esterilizacao?: string | null
          id?: string
          idade_meses?: number | null
          idade_texto?: string | null
          neurolocalizacao_texto?: string | null
          paciente: string
          raca?: string | null
          sexo?: string | null
          status_diagnostico?: Database["public"]["Enums"]["status_diagnostico"]
          suspeitas_texto?: string | null
          tutor?: string | null
          updated_at?: string
          vivo_morto?: string | null
        }
        Update: {
          codigo?: string | null
          codigo_publicacao?: string
          created_at?: string
          created_by?: string | null
          data_atendimento?: string | null
          data_desfecho?: string | null
          desfecho?: Database["public"]["Enums"]["desfecho"] | null
          diagnostico_importado_texto?: string | null
          diagnostico_texto_livre?: string | null
          especie?: string | null
          esterilizacao?: string | null
          id?: string
          idade_meses?: number | null
          idade_texto?: string | null
          neurolocalizacao_texto?: string | null
          paciente?: string
          raca?: string | null
          sexo?: string | null
          status_diagnostico?: Database["public"]["Enums"]["status_diagnostico"]
          suspeitas_texto?: string | null
          tutor?: string | null
          updated_at?: string
          vivo_morto?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      suspicion_categories: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
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
      can_manage_patient: { Args: { _patient_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "user"
      desfecho:
        | "melhora"
        | "obito"
        | "eutanasia"
        | "sem_seguimento"
        | "em_acompanhamento"
      exame_status: "solicitado" | "realizado"
      exame_tipo:
        | "RM"
        | "TC"
        | "Radiografia"
        | "LCR"
        | "Hemograma"
        | "Eletroneuromiografia"
        | "Outro"
      status_diagnostico: "aberto" | "fechado" | "sem_seguimento"
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
      app_role: ["admin", "user"],
      desfecho: [
        "melhora",
        "obito",
        "eutanasia",
        "sem_seguimento",
        "em_acompanhamento",
      ],
      exame_status: ["solicitado", "realizado"],
      exame_tipo: [
        "RM",
        "TC",
        "Radiografia",
        "LCR",
        "Hemograma",
        "Eletroneuromiografia",
        "Outro",
      ],
      status_diagnostico: ["aberto", "fechado", "sem_seguimento"],
    },
  },
} as const
