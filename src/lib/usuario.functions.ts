import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface UserData {
  id: string;
  discord_id: string;
  nombre: string;
  numero_cliente: string;
  saldo_cartera: number;
  saldo_banco: number;
  membresia: "basica" | "plus" | "black";
  discord_avatar_url: string | null;
  roles: string[];
  tarjeta_debito: {
    numero: string;
    cvv: string;
    vencimiento: string;
    congelada: boolean;
  } | null;
  ultimos_movimientos: Array<{
    id: string;
    tipo: string;
    monto: number;
    descripcion: string;
    fecha: string;
  }>;
}

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserData> => {
    const authUserId = context.userId;

    const { data: usuario, error } = await supabaseAdmin
      .from("usuarios")
      .select("*")
      .eq("auth_user_id", authUserId)
      .single();
    if (error || !usuario) throw new Error("Usuario no encontrado");

    const { data: roles } = await supabaseAdmin
      .from("roles_usuario")
      .select("role")
      .eq("usuario_id", usuario.id);

    const { data: tarjeta } = await supabaseAdmin
      .from("tarjetas_debito")
      .select("numero, cvv, vencimiento, congelada")
      .eq("usuario_id", usuario.id)
      .maybeSingle();

    const { data: movs } = await supabaseAdmin
      .from("movimientos")
      .select("id, tipo, monto, descripcion, fecha")
      .eq("usuario_id", usuario.id)
      .order("fecha", { ascending: false })
      .limit(5);

    return {
      id: usuario.id,
      discord_id: usuario.discord_id,
      nombre: usuario.nombre,
      numero_cliente: usuario.numero_cliente,
      saldo_cartera: Number(usuario.saldo_cartera),
      saldo_banco: Number(usuario.saldo_banco),
      membresia: usuario.membresia,
      discord_avatar_url: usuario.discord_avatar_url,
      roles: (roles ?? []).map((r) => r.role),
      tarjeta_debito: tarjeta
        ? {
            numero: tarjeta.numero,
            cvv: tarjeta.cvv,
            vencimiento: tarjeta.vencimiento,
            congelada: tarjeta.congelada,
          }
        : null,
      ultimos_movimientos: (movs ?? []).map((m) => ({
        id: m.id,
        tipo: m.tipo,
        monto: Number(m.monto),
        descripcion: m.descripcion,
        fecha: m.fecha,
      })),
    };
  });
