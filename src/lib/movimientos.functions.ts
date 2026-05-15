import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

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
    await usuarioIdFromAuth(context.userId);
    const { error } = await supabaseAdmin.rpc("op_depositar", {
      _monto: data.monto,
      _auth_user_id: context.userId,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const retirar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { monto: number }) =>
    z.object({ monto: montoSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await usuarioIdFromAuth(context.userId);
    const { error } = await supabaseAdmin.rpc("op_retirar", {
      _monto: data.monto,
      _auth_user_id: context.userId,
    } as never);
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
    await usuarioIdFromAuth(context.userId);
    const { data: result, error } = await supabaseAdmin.rpc("op_transferir", {
      _destino_numero: data.destino.toUpperCase(),
      _monto: data.monto,
      _concepto: data.concepto ?? "",
      _auth_user_id: context.userId,
    } as never);
    if (error) throw new Error(error.message);
    return result as {
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
    await usuarioIdFromAuth(context.userId);
    const { data, error } = await supabaseAdmin.rpc("toggle_tarjeta_debito", {
      _auth_user_id: context.userId,
    } as never);
    if (error) throw new Error(error.message);
    return { congelada: data as boolean };
  });

export interface Movimiento {
  id: string;
  tipo: string;
  monto: number;
  descripcion: string;
  fecha: string;
}

export const listarMovimientos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { filtro?: "todos" | "entradas" | "salidas" } | undefined) =>
    z.object({ filtro: z.enum(["todos", "entradas", "salidas"]).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<Movimiento[]> => {
    const uid = await usuarioIdFromAuth(context.userId);
    const entradas = ["deposito", "transferencia_recibida", "admin_dar", "condonacion"];
    const salidas = ["retiro", "transferencia_enviada", "comision", "membresia", "uso_credito", "admin_quitar", "interes_credito", "pago_credito"];

    let q = supabaseAdmin
      .from("movimientos")
      .select("id, tipo, monto, descripcion, fecha")
      .eq("usuario_id", uid)
      .order("fecha", { ascending: false })
      .limit(200);

    if (data.filtro === "entradas") q = q.in("tipo", entradas);
    else if (data.filtro === "salidas") q = q.in("tipo", salidas);

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
