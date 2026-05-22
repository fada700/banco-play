import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface HackTarget {
  id: string;
  nombre_mask: string;
  cliente_mask: string;
  tarjeta: string;
  cvv: string;
  vencimiento: string;
  saldo_aprox: number;
}

export interface HackResult {
  exito: boolean;
  monto: number;
  bruto?: number;
  comision?: number;
  razon?: "firewall" | "antivirus";
  victima_nombre?: string;
}

export const escanearHackeo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HackTarget[]> => {
    const { data, error } = await context.supabase.rpc("op_escanear_hackeo");
    if (error) throw new Error(error.message);
    return (data as unknown as HackTarget[]) ?? [];
  });

export const ejecutarHackeo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { victima_id: string }) =>
    z.object({ victima_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<HackResult> => {
    const { data: result, error } = await context.supabase.rpc("op_ejecutar_hackeo", {
      _victima_id: data.victima_id,
    });
    if (error) throw new Error(error.message);
    return result as unknown as HackResult;
  });

export const comprarAntivirus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ hasta: string }> => {
    const { data, error } = await context.supabase.rpc("op_comprar_antivirus");
    if (error) throw new Error(error.message);
    return { hasta: data as unknown as string };
  });

export interface HackeoEstado {
  costo_kit: number;
  costo_antivirus: number;
  cooldown_horas: number;
  ultimo_hackeo: string | null;
  antivirus_hasta: string | null;
  saldo_banco: number;
}

export const getHackeoEstado = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HackeoEstado> => {
    const [cfg, me] = await Promise.all([
      context.supabase.from("config").select("costo_hackeo, costo_antivirus, cooldown_hackeo_horas").eq("id", 1).single(),
      context.supabase.from("usuarios").select("ultimo_hackeo, antivirus_hasta, saldo_banco").eq("auth_user_id", context.userId).single(),
    ]);
    if (cfg.error) throw new Error(cfg.error.message);
    if (me.error) throw new Error(me.error.message);
    return {
      costo_kit: Number(cfg.data.costo_hackeo),
      costo_antivirus: Number(cfg.data.costo_antivirus),
      cooldown_horas: cfg.data.cooldown_hackeo_horas,
      ultimo_hackeo: me.data.ultimo_hackeo,
      antivirus_hasta: me.data.antivirus_hasta,
      saldo_banco: Number(me.data.saldo_banco),
    };
  });
