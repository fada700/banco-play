import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getMe } from "@/lib/usuario.functions";
import {
  listarSolicitudes, aprobarSolicitud, rechazarSolicitud,
  listarDeudores, ajustarLimite, condonarDeuda,
} from "@/lib/staff.functions";
import { formatMXN } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/trabajador")({
  component: TrabajadorPage,
});

function TrabajadorPage() {
  const qc = useQueryClient();
  const fetchMe = useServerFn(getMe);
  const fnList = useServerFn(listarSolicitudes);
  const fnApr = useServerFn(aprobarSolicitud);
  const fnRej = useServerFn(rechazarSolicitud);
  const fnDeudores = useServerFn(listarDeudores);
  const fnLimite = useServerFn(ajustarLimite);
  const fnCondonar = useServerFn(condonarDeuda);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const isStaff = me?.roles.includes("admin") || me?.roles.includes("trabajador");

  const { data: sols } = useQuery({ queryKey: ["sols"], queryFn: () => fnList(), enabled: !!isStaff });
  const { data: deudores } = useQuery({ queryKey: ["deudores"], queryFn: () => fnDeudores(), enabled: !!isStaff });

  const [busy, setBusy] = useState(false);
  const [editLimite, setEditLimite] = useState<Record<string, string>>({});

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    if (busy) return; setBusy(true);
    try { await fn(); toast.success(ok); qc.invalidateQueries({ queryKey: ["sols"] }); qc.invalidateQueries({ queryKey: ["deudores"] }); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  if (me && !isStaff) {
    throw redirect({ to: "/home" });
  }

  return (
    <div className="min-h-screen pb-12">
      <header className="container-app pt-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Panel trabajador</h1>
          <p className="text-sm text-muted-foreground">Solicitudes y deudores</p>
        </div>
        {me?.roles.includes("admin") && (
          <Link to="/admin" className="text-xs text-muted-foreground underline">Ir a admin</Link>
        )}
      </header>

      <section className="container-app mt-6">
        <h2 className="text-base font-semibold mb-3">Solicitudes pendientes</h2>
        <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
          {!sols?.length && <div className="p-5 text-sm text-muted-foreground text-center">Sin solicitudes</div>}
          {sols?.map((s) => (
            <div key={s.id} className="p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{s.usuario_nombre}</div>
                <div className="text-xs text-muted-foreground font-mono">{s.numero_cliente} · {s.tipo}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => run(() => fnApr({ data: { id: s.id } }), "Aprobada")}
                  className="bmx-tap rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold">Aprobar</button>
                <button onClick={() => run(() => fnRej({ data: { id: s.id } }), "Rechazada")}
                  className="bmx-tap rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">Rechazar</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-app mt-8">
        <h2 className="text-base font-semibold mb-3">Deudores</h2>
        <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
          {!deudores?.length && <div className="p-5 text-sm text-muted-foreground text-center">Sin deudores</div>}
          {deudores?.map((d) => (
            <div key={d.usuario_id} className="p-4 space-y-2">
              <div className="flex justify-between items-baseline">
                <div>
                  <div className="text-sm font-medium">{d.nombre}</div>
                  <div className="text-xs text-muted-foreground font-mono">{d.numero_cliente}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono font-semibold">{formatMXN(d.saldo_usado)}</div>
                  <div className="text-[10px] text-muted-foreground">de {formatMXN(d.limite)} · {d.estado}</div>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <input type="number"
                  placeholder={`Límite ${d.limite}`}
                  value={editLimite[d.usuario_id] ?? ""}
                  onChange={(e) => setEditLimite((m) => ({ ...m, [d.usuario_id]: e.target.value }))}
                  className="flex-1 rounded-lg bg-background border border-border px-2 py-1.5 text-xs font-mono" />
                <button
                  disabled={!editLimite[d.usuario_id]}
                  onClick={() => run(() => fnLimite({ data: { usuario_id: d.usuario_id, nuevo_limite: Number(editLimite[d.usuario_id]) } }), "Límite ajustado")}
                  className="bmx-tap rounded-lg border border-border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                >Ajustar</button>
                <button onClick={() => run(() => fnCondonar({ data: { usuario_id: d.usuario_id } }), "Deuda condonada")}
                  className="bmx-tap rounded-lg border border-destructive text-destructive px-3 py-1.5 text-xs font-medium">Condonar</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
