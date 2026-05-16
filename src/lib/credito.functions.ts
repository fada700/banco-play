import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface CreditoInfo {
  estado: "sin_solicitar" | "pendiente" | "activa" | "bloqueada" | "rechazada";
  numero: string | null;
  cvv: string | null;
  vencimiento: string | null;
  limite: number;
  saldo_usado: number;
  disponible: number;
  nivel: number;
  score: number;
  pagos_a_tiempo: number;
  dias_vencidos: number;
  fecha_limite_pago: string | null;
}

async function uidFromAuth(authUserId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("usuarios").select("id").eq("auth_user_id", authUserId).single();
  if (error || !data) throw new Error("Usuario no encontrado");
  return data.id;
}

export const getCredito = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreditoInfo | null> => {
    const uid = await uidFromAuth(context.userId);
    const { data } = await supabaseAdmin
      .from("tarjetas_credito").select("*").eq("usuario_id", uid).maybeSingle();
    if (!data) return null;
    const limite = Number(data.limite);
    const usado = Number(data.saldo_usado);
    return {
      estado: data.estado,
      numero: data.numero,
      cvv: data.cvv,
      vencimiento: data.vencimiento,
      limite,
      saldo_usado: usado,
      disponible: Math.max(0, limite - usado),
      nivel: data.nivel,
      score: data.score,
      pagos_a_tiempo: data.pagos_a_tiempo,
      dias_vencidos: data.dias_vencidos,
      fecha_limite_pago: data.fecha_limite_pago,
    };
  });

export const solicitarCredito = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.rpc("solicitar_tarjeta_credito");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const montoSchema = z.number().positive().max(10_000_000);

export const usarCredito = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { monto: number }) => z.object({ monto: montoSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("usar_credito", { _monto: data.monto });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const pagarCredito = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { monto: number }) => z.object({ monto: montoSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("pagar_credito", { _monto: data.monto });
    if (error) throw new Error(error.message);
    return r as unknown as { pagado: number; liquidada: boolean };
  });
