import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsPwa } from "@/hooks/use-is-pwa";
import { getMe } from "@/lib/usuario.functions";
import { buscarUsuarios, adminAjustarSaldo, getGanancias, setDueno, listarCreditos } from "@/lib/staff.functions";
import { formatMXN } from "@/lib/format";
import { PwaBlocked, NoAccess } from "./trabajador-panel";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/admin-login" });
  },
  component: AdminPage,
});

function AdminPage() {
  const isPwa = useIsPwa();
  const qc = useQueryClient();
  const fetchMe = useServerFn(getMe);
  const fnBuscar = useServerFn(buscarUsuarios);
  const fnAjustar = useServerFn(adminAjustarSaldo);
  const fnGan = useServerFn(getGanancias);
  const fnDueno = useServerFn(setDueno);
  const fnCreditos = useServerFn(listarCreditos);

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["me"], queryFn: () => fetchMe(), staleTime: 60_000,
  });
  const isAdmin = !!me?.roles.includes("admin");

  const { data: creditos } = useQuery({
    queryKey: ["admin-creditos"], queryFn: () => fnCreditos(),
    enabled: isAdmin && isPwa === false,
    staleTime: 30_000,
  });

  const [q, setQ] = useState("");
  const { data: users } = useQuery({
    queryKey: ["buscar", q],
    queryFn: () => fnBuscar({ data: { q } }),
    enabled: isAdmin && isPwa === false,
    staleTime: 30_000,
  });
  const { data: gan } = useQuery({
    queryKey: ["ganancias"], queryFn: () => fnGan(),
    enabled: isAdmin && isPwa === false,
    staleTime: 30_000,
  });

  const [duenoInput, setDuenoInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [delta, setDelta] = useState("");
  const [cuenta, setCuenta] = useState<"banco" | "cartera">("banco");
  const [signo, setSigno] = useState<1 | -1>(1);
  const [motivo, setMotivo] = useState("");

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    if (busy) return; setBusy(true);
    try {
      await fn(); toast.success(ok);
      qc.invalidateQueries({ queryKey: ["buscar"] });
      qc.invalidateQueries({ queryKey: ["ganancias"] });
      setDelta(""); setMotivo(""); setOpenId(null);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  if (isPwa === null || meLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground bmx-pulse">Cargando…</div>;
  }
  if (isPwa) return <PwaBlocked path="/admin" />;
  if (!isAdmin) return <NoAccess />;

  return (
    <div className="min-h-screen pb-12">
      <header className="container-app pt-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Panel admin</h1>
          <p className="text-sm text-muted-foreground">Control total</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/trabajador-panel" className="text-xs text-muted-foreground underline">Trabajador</Link>
          <Link to="/home" className="text-xs text-muted-foreground underline">Salir</Link>
        </div>
      </header>

      <section className="container-app mt-6 grid grid-cols-2 gap-3">
        <Stat label="Hoy" value={formatMXN(gan?.hoy ?? 0)} />
        <Stat label="Semana" value={formatMXN(gan?.semana ?? 0)} />
        <Stat label="Mes" value={formatMXN(gan?.mes ?? 0)} />
        <Stat label="Total" value={formatMXN(gan?.total ?? 0)} />
      </section>

      <section className="container-app mt-6 rounded-2xl border border-border bg-surface p-4">
        <div className="text-sm font-semibold mb-2">Dueño del banco</div>
        <p className="text-xs text-muted-foreground mb-3">
          Discord ID actual: <span className="font-mono">{gan?.dueno_discord_id ?? "ninguno"}</span>
        </p>
        <div className="flex gap-2">
          <input value={duenoInput} onChange={(e) => setDuenoInput(e.target.value)}
            placeholder="Discord ID o vacío para quitar"
            className="flex-1 rounded-lg bg-background border border-border px-3 py-2 text-sm font-mono" />
          <button
            onClick={() => run(() => fnDueno({ data: { discord_id: duenoInput } }), "Dueño actualizado")}
            disabled={busy}
            className="bmx-tap rounded-lg bg-primary text-primary-foreground px-4 text-sm font-semibold disabled:opacity-50">
            Guardar
          </button>
        </div>
      </section>

      <section className="container-app mt-8">
        <h2 className="text-base font-semibold mb-3">Buscar usuarios</h2>
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre, número cliente o Discord ID"
          className="w-full rounded-xl bg-surface border border-border px-3 py-3 text-sm" />
        <div className="mt-3 rounded-2xl border border-border bg-surface divide-y divide-border">
          {!users?.length && <div className="p-5 text-sm text-muted-foreground text-center">Sin resultados</div>}
          {users?.map((u) => (
            <div key={u.id} className="p-4">
              <button onClick={() => setOpenId((id) => (id === u.id ? null : u.id))}
                className="w-full flex justify-between items-baseline text-left">
                <div>
                  <div className="text-sm font-medium">{u.nombre}</div>
                  <div className="text-xs text-muted-foreground font-mono">{u.numero_cliente} · {u.discord_id}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono">{formatMXN(u.saldo_banco)}</div>
                  <div className="text-[10px] text-muted-foreground">cartera {formatMXN(u.saldo_cartera)}</div>
                </div>
              </button>
              {openId === u.id && (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <select value={cuenta} onChange={(e) => setCuenta(e.target.value as "banco" | "cartera")}
                      className="rounded-lg bg-background border border-border px-2 py-2 text-xs">
                      <option value="banco">Banco</option>
                      <option value="cartera">Cartera</option>
                    </select>
                    <select value={signo} onChange={(e) => setSigno(Number(e.target.value) as 1 | -1)}
                      className="rounded-lg bg-background border border-border px-2 py-2 text-xs">
                      <option value={1}>Dar (+)</option>
                      <option value={-1}>Quitar (−)</option>
                    </select>
                  </div>
                  <input type="number" placeholder="Monto" value={delta}
                    onChange={(e) => setDelta(e.target.value)}
                    className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm font-mono" />
                  <input placeholder="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)}
                    className="w-full rounded-lg bg-background border border-border px-3 py-2 text-xs" />
                  <button
                    disabled={busy || !delta || Number(delta) <= 0}
                    onClick={() => run(
                      () => fnAjustar({ data: { usuario_id: u.id, delta: signo * Number(delta), cuenta, motivo } }),
                      signo > 0 ? "Dinero acreditado" : "Dinero retirado",
                    )}
                    className="bmx-tap w-full rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-semibold disabled:opacity-50">
                    Aplicar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="container-app mt-8">
        <h2 className="text-base font-semibold mb-3">Tarjetas de crédito activas</h2>
        <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
          {!creditos?.length && <div className="p-5 text-sm text-muted-foreground text-center">Sin tarjetas de crédito</div>}
          {creditos?.map((c) => (
            <div key={c.usuario_id} className="p-4 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{c.nombre}</div>
                <div className="text-[11px] text-muted-foreground font-mono truncate">
                  {c.numero_cliente} · {c.estado} · N{c.nivel} · score {c.score}
                  {c.dias_vencidos > 0 && <span className="text-destructive"> · {c.dias_vencidos}d vencido</span>}
                </div>
              </div>
              <div className="text-right shrink-0 ml-3">
                <div className="text-sm font-mono">{formatMXN(c.saldo_usado)}</div>
                <div className="text-[10px] text-muted-foreground">de {formatMXN(c.limite)}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-sm font-mono font-semibold mt-1">{value}</div>
    </div>
  );
}
