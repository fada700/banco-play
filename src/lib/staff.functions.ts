import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertStaff(authUserId: string, requireAdmin = false) {
  const { data: u } = await supabaseAdmin
    .from("usuarios").select("id").eq("auth_user_id", authUserId).single();
  if (!u) throw new Error("No autorizado");
  const { data: roles } = await supabaseAdmin
    .from("roles_usuario").select("role").eq("usuario_id", u.id);
  const set = new Set((roles ?? []).map((r) => r.role));
  if (requireAdmin) {
    if (!set.has("admin")) throw new Error("Solo admin");
  } else {
    if (!set.has("admin") && !set.has("trabajador")) throw new Error("No autorizado");
  }
  return u.id;
}

export interface SolicitudPendiente {
  id: string;
  tipo: string;
  fecha: string;
  usuario_id: string;
  usuario_nombre: string;
  numero_cliente: string;
}

export const listarSolicitudes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SolicitudPendiente[]> => {
    await assertStaff(context.userId);
    const { data } = await supabaseAdmin
      .from("solicitudes")
      .select("id, tipo, fecha, usuario_id")
      .eq("estado", "pendiente")
      .order("fecha", { ascending: false })
      .limit(100);
    if (!data?.length) return [];
    const ids = [...new Set(data.map((s) => s.usuario_id))];
    const { data: users } = await supabaseAdmin
      .from("usuarios").select("id, nombre, numero_cliente").in("id", ids);
    const byId = new Map((users ?? []).map((u) => [u.id, u]));
    return data.map((s) => ({
      id: s.id,
      tipo: s.tipo,
      fecha: s.fecha,
      usuario_id: s.usuario_id,
      usuario_nombre: byId.get(s.usuario_id)?.nombre ?? "—",
      numero_cliente: byId.get(s.usuario_id)?.numero_cliente ?? "—",
    }));
  });

export const aprobarSolicitud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("aprobar_tarjeta_credito", { _solicitud_id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rechazarSolicitud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("rechazar_tarjeta_credito", { _solicitud_id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface DeudorRow {
  usuario_id: string;
  nombre: string;
  numero_cliente: string;
  saldo_usado: number;
  limite: number;
  dias_vencidos: number;
  estado: string;
  score: number;
}

export const listarDeudores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DeudorRow[]> => {
    await assertStaff(context.userId);
    const { data } = await supabaseAdmin
      .from("tarjetas_credito")
      .select("usuario_id, saldo_usado, limite, dias_vencidos, estado, score")
      .gt("saldo_usado", 0)
      .order("saldo_usado", { ascending: false });
    if (!data?.length) return [];
    const ids = data.map((r) => r.usuario_id);
    const { data: users } = await supabaseAdmin
      .from("usuarios").select("id, nombre, numero_cliente").in("id", ids);
    const byId = new Map((users ?? []).map((u) => [u.id, u]));
    return data.map((r) => ({
      usuario_id: r.usuario_id,
      nombre: byId.get(r.usuario_id)?.nombre ?? "—",
      numero_cliente: byId.get(r.usuario_id)?.numero_cliente ?? "—",
      saldo_usado: Number(r.saldo_usado),
      limite: Number(r.limite),
      dias_vencidos: r.dias_vencidos,
      estado: r.estado,
      score: r.score,
    }));
  });

export interface CreditoRow {
  usuario_id: string;
  nombre: string;
  numero_cliente: string;
  estado: string;
  limite: number;
  saldo_usado: number;
  disponible: number;
  score: number;
  dias_vencidos: number;
  nivel: number;
}

export const listarCreditos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreditoRow[]> => {
    await assertStaff(context.userId);
    const { data } = await supabaseAdmin
      .from("tarjetas_credito")
      .select("usuario_id, estado, limite, saldo_usado, score, dias_vencidos, nivel")
      .neq("estado", "sin_solicitar")
      .order("saldo_usado", { ascending: false });
    if (!data?.length) return [];
    const ids = data.map((r) => r.usuario_id);
    const { data: users } = await supabaseAdmin
      .from("usuarios").select("id, nombre, numero_cliente").in("id", ids);
    const byId = new Map((users ?? []).map((u) => [u.id, u]));
    return data.map((r) => {
      const limite = Number(r.limite);
      const usado = Number(r.saldo_usado);
      return {
        usuario_id: r.usuario_id,
        nombre: byId.get(r.usuario_id)?.nombre ?? "—",
        numero_cliente: byId.get(r.usuario_id)?.numero_cliente ?? "—",
        estado: r.estado,
        limite,
        saldo_usado: usado,
        disponible: Math.max(0, limite - usado),
        score: r.score,
        dias_vencidos: r.dias_vencidos,
        nivel: r.nivel,
      };
    });
  });

export const ajustarLimite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { usuario_id: string; nuevo_limite: number }) =>
    z.object({ usuario_id: z.string().uuid(), nuevo_limite: z.number().min(0).max(10_000_000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("ajustar_limite_credito", {
      _usuario_id: data.usuario_id, _nuevo_limite: data.nuevo_limite,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const condonarDeuda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { usuario_id: string }) =>
    z.object({ usuario_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("condonar_deuda", { _usuario_id: data.usuario_id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// === ADMIN ===

export interface UsuarioBusquedaRow {
  id: string;
  nombre: string;
  numero_cliente: string;
  discord_id: string;
  saldo_banco: number;
  saldo_cartera: number;
  membresia: string;
}

export const buscarUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q?: string } | undefined) =>
    z.object({ q: z.string().max(80).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<UsuarioBusquedaRow[]> => {
    await assertStaff(context.userId);
    const q = (data.q ?? "").trim();
    let query = supabaseAdmin
      .from("usuarios")
      .select("id, nombre, numero_cliente, discord_id, saldo_banco, saldo_cartera, membresia")
      .order("nombre", { ascending: true })
      .limit(40);
    if (q.length > 0) {
      query = query.or(
        `nombre.ilike.%${q}%,numero_cliente.ilike.%${q}%,discord_username.ilike.%${q}%,discord_id.eq.${q}`,
      );
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id as string,
      nombre: r.nombre as string,
      numero_cliente: r.numero_cliente as string,
      discord_id: r.discord_id as string,
      saldo_banco: Number(r.saldo_banco),
      saldo_cartera: Number(r.saldo_cartera),
      membresia: r.membresia as string,
    }));
  });

export const adminAjustarSaldo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { usuario_id: string; delta: number; cuenta: "banco" | "cartera"; motivo?: string }) =>
    z.object({
      usuario_id: z.string().uuid(),
      delta: z.number().min(-10_000_000).max(10_000_000).refine((n) => n !== 0, "Monto inválido"),
      cuenta: z.enum(["banco", "cartera"]),
      motivo: z.string().max(120).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId, true);
    const { error } = await context.supabase.rpc("admin_ajustar_saldo", {
      _usuario_id: data.usuario_id,
      _delta: data.delta,
      _cuenta: data.cuenta,
      _motivo: data.motivo ?? "",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface GananciasResumen {
  hoy: number;
  semana: number;
  mes: number;
  total: number;
  dueno_discord_id: string | null;
}

export const getGanancias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GananciasResumen> => {
    await assertStaff(context.userId);
    const { data } = await supabaseAdmin.from("ganancias_banco").select("monto, fecha");
    const now = Date.now();
    const day = 86400000;
    let hoy = 0, semana = 0, mes = 0, total = 0;
    const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
    for (const r of data ?? []) {
      const m = Number(r.monto);
      const t = new Date(r.fecha).getTime();
      total += m;
      if (t >= startOfDay.getTime()) hoy += m;
      if (now - t <= 7 * day) semana += m;
      if (now - t <= 30 * day) mes += m;
    }
    const { data: cfg } = await supabaseAdmin.from("config").select("dueno_discord_id").eq("id", 1).single();
    return { hoy, semana, mes, total, dueno_discord_id: cfg?.dueno_discord_id ?? null };
  });

export const setDueno = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { discord_id: string }) =>
    z.object({ discord_id: z.string().max(40) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("set_dueno_banco", { _discord_id: data.discord_id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
