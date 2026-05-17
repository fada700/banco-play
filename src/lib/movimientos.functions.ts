import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

type TipoMovimiento = Database["public"]["Enums"]["tipo_movimiento"];

const montoSchema = z.number().positive().max(10_000_000);

async function usuarioIdFromAuth(authUserId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("usuarios")
    .select("id")
    .eq("auth_user_id", authUserId)
    .single();
  if (error || !data) throw new Error("Usuario no encontrado");
  return data.id;
}

export const depositar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { monto: number }) =>
    z.object({ monto: montoSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("op_depositar", { _monto: data.monto });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const retirar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { monto: number }) =>
    z.object({ monto: montoSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("op_retirar", { _monto: data.monto });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const transferir = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { destino: string; monto: number; concepto?: string }) =>
    z.object({
      destino: z.string().min(1).max(20).regex(/^[A-Z0-9-]+$/i),
      monto: montoSchema,
      concepto: z.string().max(80).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("op_transferir", {
      _destino_numero: data.destino.toUpperCase(),
      _monto: data.monto,
      _concepto: data.concepto ?? "",
    });
    if (error) throw new Error(error.message);
    return result as unknown as {
      monto: number;
      comision: number;
      total: number;
      destino_nombre: string;
      destino_numero: string;
    };
  });

export const toggleTarjeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("toggle_tarjeta_debito");
    if (error) throw new Error(error.message);
    return { congelada: data as boolean };
  });

export const verificarCvv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cvv: string }) =>
    z.object({ cvv: z.string().regex(/^\d{3}$/) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const uid = await usuarioIdFromAuth(context.userId);
    const { data: row } = await supabaseAdmin
      .from("tarjetas_debito")
      .select("cvv, congelada")
      .eq("usuario_id", uid)
      .maybeSingle();
    if (!row) throw new Error("No tienes tarjeta de débito");
    if (row.congelada) throw new Error("Tu tarjeta está congelada");
    if (row.cvv !== data.cvv) throw new Error("CVV incorrecto");
    return { ok: true };
  });

export interface Movimiento {
  id: string;
  tipo: TipoMovimiento;
  monto: number;
  descripcion: string;
  fecha: string;
}

const ENTRADAS: TipoMovimiento[] = ["deposito", "transferencia_recibida", "admin_dar", "condonacion"];
const SALIDAS: TipoMovimiento[] = ["retiro", "transferencia_enviada", "comision", "membresia", "uso_credito", "admin_quitar", "interes_credito", "pago_credito"];

export const listarMovimientos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { filtro?: "todos" | "entradas" | "salidas" } | undefined) =>
    z.object({ filtro: z.enum(["todos", "entradas", "salidas"]).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<Movimiento[]> => {
    const uid = await usuarioIdFromAuth(context.userId);

    let q = supabaseAdmin
      .from("movimientos")
      .select("id, tipo, monto, descripcion, fecha")
      .eq("usuario_id", uid)
      .order("fecha", { ascending: false })
      .limit(200);

    if (data.filtro === "entradas") q = q.in("tipo", ENTRADAS);
    else if (data.filtro === "salidas") q = q.in("tipo", SALIDAS);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id,
      tipo: r.tipo,
      monto: Number(r.monto),
      descripcion: r.descripcion,
      fecha: r.fecha,
    }));
  });

export function esEntrada(tipo: string): boolean {
  return (ENTRADAS as string[]).includes(tipo);
}
