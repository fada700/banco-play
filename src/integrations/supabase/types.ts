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
      config: {
        Row: {
          comision_porcentaje: number
          costo_membresia_black: number
          costo_membresia_plus: number
          dueno_discord_id: string | null
          id: number
          interes_diario_porcentaje: number
        }
        Insert: {
          comision_porcentaje?: number
          costo_membresia_black?: number
          costo_membresia_plus?: number
          dueno_discord_id?: string | null
          id?: number
          interes_diario_porcentaje?: number
        }
        Update: {
          comision_porcentaje?: number
          costo_membresia_black?: number
          costo_membresia_plus?: number
          dueno_discord_id?: string | null
          id?: number
          interes_diario_porcentaje?: number
        }
        Relationships: []
      }
      ganancias_banco: {
        Row: {
          concepto: string
          fecha: string
          id: string
          monto: number
          usuario_id: string | null
        }
        Insert: {
          concepto: string
          fecha?: string
          id?: string
          monto: number
          usuario_id?: string | null
        }
        Update: {
          concepto?: string
          fecha?: string
          id?: string
          monto?: number
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ganancias_banco_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      login_codigos: {
        Row: {
          codigo_hash: string
          creado_en: string
          discord_id: string
          expira_en: string
          id: string
          intentos: number
          usado: boolean
        }
        Insert: {
          codigo_hash: string
          creado_en?: string
          discord_id: string
          expira_en: string
          id?: string
          intentos?: number
          usado?: boolean
        }
        Update: {
          codigo_hash?: string
          creado_en?: string
          discord_id?: string
          expira_en?: string
          id?: string
          intentos?: number
          usado?: boolean
        }
        Relationships: []
      }
      membresias: {
        Row: {
          activa: boolean
          fecha_inicio: string
          fecha_renovacion: string
          id: string
          tipo: Database["public"]["Enums"]["tipo_membresia"]
          usuario_id: string
        }
        Insert: {
          activa?: boolean
          fecha_inicio?: string
          fecha_renovacion: string
          id?: string
          tipo: Database["public"]["Enums"]["tipo_membresia"]
          usuario_id: string
        }
        Update: {
          activa?: boolean
          fecha_inicio?: string
          fecha_renovacion?: string
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_membresia"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membresias_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos: {
        Row: {
          contraparte_id: string | null
          descripcion: string
          fecha: string
          id: string
          monto: number
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
          usuario_id: string
        }
        Insert: {
          contraparte_id?: string | null
          descripcion: string
          fecha?: string
          id?: string
          monto: number
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
          usuario_id: string
        }
        Update: {
          contraparte_id?: string | null
          descripcion?: string
          fecha?: string
          id?: string
          monto?: number
          tipo?: Database["public"]["Enums"]["tipo_movimiento"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_contraparte_id_fkey"
            columns: ["contraparte_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      roles_usuario: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          usuario_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          usuario_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_usuario_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitudes: {
        Row: {
          estado: Database["public"]["Enums"]["estado_solicitud"]
          fecha: string
          id: string
          resuelta_en: string | null
          resuelta_por: string | null
          tipo: string
          usuario_id: string
        }
        Insert: {
          estado?: Database["public"]["Enums"]["estado_solicitud"]
          fecha?: string
          id?: string
          resuelta_en?: string | null
          resuelta_por?: string | null
          tipo: string
          usuario_id: string
        }
        Update: {
          estado?: Database["public"]["Enums"]["estado_solicitud"]
          fecha?: string
          id?: string
          resuelta_en?: string | null
          resuelta_por?: string | null
          tipo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_resuelta_por_fkey"
            columns: ["resuelta_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      tarjetas_credito: {
        Row: {
          cvv: string | null
          dias_vencidos: number
          estado: Database["public"]["Enums"]["estado_credito"]
          fecha_limite_pago: string | null
          fecha_uso: string | null
          id: string
          limite: number
          nivel: number
          numero: string | null
          pagos_a_tiempo: number
          saldo_usado: number
          score: number
          usuario_id: string
          vencimiento: string | null
        }
        Insert: {
          cvv?: string | null
          dias_vencidos?: number
          estado?: Database["public"]["Enums"]["estado_credito"]
          fecha_limite_pago?: string | null
          fecha_uso?: string | null
          id?: string
          limite?: number
          nivel?: number
          numero?: string | null
          pagos_a_tiempo?: number
          saldo_usado?: number
          score?: number
          usuario_id: string
          vencimiento?: string | null
        }
        Update: {
          cvv?: string | null
          dias_vencidos?: number
          estado?: Database["public"]["Enums"]["estado_credito"]
          fecha_limite_pago?: string | null
          fecha_uso?: string | null
          id?: string
          limite?: number
          nivel?: number
          numero?: string | null
          pagos_a_tiempo?: number
          saldo_usado?: number
          score?: number
          usuario_id?: string
          vencimiento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tarjetas_credito_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      tarjetas_debito: {
        Row: {
          congelada: boolean
          creada_en: string
          cvv: string
          id: string
          numero: string
          usuario_id: string
          vencimiento: string
        }
        Insert: {
          congelada?: boolean
          creada_en?: string
          cvv: string
          id?: string
          numero: string
          usuario_id: string
          vencimiento: string
        }
        Update: {
          congelada?: boolean
          creada_en?: string
          cvv?: string
          id?: string
          numero?: string
          usuario_id?: string
          vencimiento?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarjetas_debito_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          auth_user_id: string | null
          bloqueado_hasta: string | null
          discord_avatar_url: string | null
          discord_id: string
          discord_username: string
          fecha_registro: string
          id: string
          intentos_fallidos: number
          membresia: Database["public"]["Enums"]["tipo_membresia"]
          nip_hash: string | null
          nombre: string
          numero_cliente: string
          saldo_banco: number
          saldo_cartera: number
        }
        Insert: {
          auth_user_id?: string | null
          bloqueado_hasta?: string | null
          discord_avatar_url?: string | null
          discord_id: string
          discord_username: string
          fecha_registro?: string
          id?: string
          intentos_fallidos?: number
          membresia?: Database["public"]["Enums"]["tipo_membresia"]
          nip_hash?: string | null
          nombre: string
          numero_cliente: string
          saldo_banco?: number
          saldo_cartera?: number
        }
        Update: {
          auth_user_id?: string | null
          bloqueado_hasta?: string | null
          discord_avatar_url?: string | null
          discord_id?: string
          discord_username?: string
          fecha_registro?: string
          id?: string
          intentos_fallidos?: number
          membresia?: Database["public"]["Enums"]["tipo_membresia"]
          nip_hash?: string | null
          nombre?: string
          numero_cliente?: string
          saldo_banco?: number
          saldo_cartera?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_ajustar_saldo: {
        Args: {
          _cuenta: string
          _delta: number
          _motivo: string
          _usuario_id: string
        }
        Returns: undefined
      }
      ajustar_limite_credito: {
        Args: { _nuevo_limite: number; _usuario_id: string }
        Returns: undefined
      }
      aprobar_tarjeta_credito: {
        Args: { _solicitud_id: string }
        Returns: undefined
      }
      condonar_deuda: { Args: { _usuario_id: string }; Returns: undefined }
      current_usuario_id: { Args: never; Returns: string }
      dueno_usuario_id: { Args: never; Returns: string }
      generar_numero_cliente: { Args: never; Returns: string }
      has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      op_depositar: { Args: { _monto: number }; Returns: undefined }
      op_retirar: { Args: { _monto: number }; Returns: undefined }
      op_transferir: {
        Args: { _concepto: string; _destino_numero: string; _monto: number }
        Returns: Json
      }
      pagar_credito: { Args: { _monto: number }; Returns: Json }
      rechazar_tarjeta_credito: {
        Args: { _solicitud_id: string }
        Returns: undefined
      }
      registrar_ganancia: {
        Args: { _concepto: string; _monto: number; _usuario: string }
        Returns: undefined
      }
      set_dueno_banco: { Args: { _discord_id: string }; Returns: undefined }
      solicitar_tarjeta_credito: { Args: never; Returns: string }
      toggle_tarjeta_debito: { Args: never; Returns: boolean }
      usar_credito: { Args: { _monto: number }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "trabajador" | "usuario"
      estado_credito:
        | "sin_solicitar"
        | "pendiente"
        | "activa"
        | "bloqueada"
        | "rechazada"
      estado_solicitud: "pendiente" | "aprobada" | "rechazada"
      tipo_membresia: "basica" | "plus" | "black"
      tipo_movimiento:
        | "deposito"
        | "retiro"
        | "transferencia_enviada"
        | "transferencia_recibida"
        | "comision"
        | "pago_credito"
        | "uso_credito"
        | "interes_credito"
        | "membresia"
        | "admin_dar"
        | "admin_quitar"
        | "condonacion"
        | "ganancia_banco"
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
      app_role: ["admin", "trabajador", "usuario"],
      estado_credito: [
        "sin_solicitar",
        "pendiente",
        "activa",
        "bloqueada",
        "rechazada",
      ],
      estado_solicitud: ["pendiente", "aprobada", "rechazada"],
      tipo_membresia: ["basica", "plus", "black"],
      tipo_movimiento: [
        "deposito",
        "retiro",
        "transferencia_enviada",
        "transferencia_recibida",
        "comision",
        "pago_credito",
        "uso_credito",
        "interes_credito",
        "membresia",
        "admin_dar",
        "admin_quitar",
        "condonacion",
        "ganancia_banco",
      ],
    },
  },
} as const
