import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getCredito, solicitarCredito, usarCredito, pagarCredito } from "@/lib/credito.functions";
import { formatMXN, maskCardNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/credito")({
  component: CreditoPage,
});

function CreditoPage() {
  const qc = useQueryClient();
  const fnGet = useServerFn(getCredito);
  const fnSolicitar = useServerFn(solicitarCredito);
  const fnUsar = useServerFn(usarCredito);
  const fnPagar = useServerFn(pagarCredito);

  const { data, isLoading } = useQuery({ queryKey: ["credito"], queryFn: () => fnGet() });

  const [usarMonto, setUsarMonto] = useState("");
  const [pagarMonto, setPagarMonto] = useState("");
  const [busy, setBusy] = useState(false);
  const [flipped, setFlipped] = useState(false);

  const handle = async (fn: () => Promise<unknown>, ok: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      qc.invalidateQueries({ queryKey: ["credito"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      setUsarMonto(""); setPagarMonto("");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground bmx-pulse">Cargando…</div>;

  const c = data;
  return (
    <div className="min-h-screen pb-12">
      <header className="container-app pt-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tarjeta de crédito</h1>
          <p className="text-sm text-muted-foreground">Gestiona tu línea</p>
        </div>
        <Link to="/tarjetas" className="text-xs text-muted-foreground underline">Volver</Link>
      </header>

      {(!c || c.estado === "sin_solicitar" || c.estado === "rechazada") && (
        <section className="container-app mt-8">
          <div className="rounded-2xl border border-border bg-surface p-6 text-center">
            <div className="text-base font-semibold">Solicita tu tarjeta de crédito</div>
            <p className="text-sm text-muted-foreground mt-2">
              Empezarás con un límite de {formatMXN(5000)}. Tu solicitud será revisada por un trabajador.
            </p>
            {c?.estado === "rechazada" && (
              <div className="mt-3 text-xs text-destructive">Tu última solicitud fue rechazada.</div>
            )}
            <button
              onClick={() => handle(() => fnSolicitar(), "Solicitud enviada")}
              disabled={busy}
              className="bmx-tap mt-5 w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold disabled:opacity-50"
            >
              Solicitar tarjeta
            </button>
          </div>
        </section>
      )}

      {c?.estado === "pendiente" && (
        <section className="container-app mt-8">
          <div className="rounded-2xl border border-dashed border-border p-6 text-center">
            <div className="text-base font-semibold">Solicitud en revisión</div>
            <p className="text-sm text-muted-foreground mt-2">Un trabajador la revisará pronto.</p>
          </div>
        </section>
      )}

      {(c?.estado === "activa" || c?.estado === "bloqueada") && c.numero && (
        <>
          <section className="container-app mt-6">
            <div className="flip-perspective">
              <div className={`flip-inner ${flipped ? "flipped" : ""} cursor-pointer`} onClick={() => setFlipped((v) => !v)}>
                <div className="flip-face bg-gradient-to-br from-amber-700 via-amber-900 to-stone-900 text-amber-50 rounded-2xl p-5 aspect-[1.6/1] flex flex-col justify-between shadow-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-xs uppercase tracking-widest opacity-70">Crédito</div>
                      <div className="text-sm font-semibold mt-1">Banco De México</div>
                    </div>
                    {c.estado === "bloqueada" && (
                      <div className="text-[10px] uppercase tracking-widest bg-white/15 px-2 py-1 rounded-full">Bloqueada</div>
                    )}
                  </div>
                  <div className="font-mono text-lg tracking-widest">{maskCardNumber(c.numero)}</div>
                  <div className="flex justify-between items-end text-xs">
                    <div><div className="opacity-50 uppercase">Límite</div><div className="font-mono">{formatMXN(c.limite)}</div></div>
                    <div><div className="opacity-50 uppercase">Vence</div><div className="font-mono">{c.vencimiento}</div></div>
                  </div>
                </div>
                <div className="flip-face flip-face-back bg-gradient-to-br from-amber-700 via-amber-900 to-stone-900 text-amber-50 rounded-2xl p-5 aspect-[1.6/1] flex flex-col justify-between shadow-lg">
                  <div className="h-10 -mx-5 bg-black/60 mt-3" />
                  <div className="bg-white/90 text-black rounded px-3 py-2 font-mono text-lg w-32 self-end">{c.cvv}</div>
                  <div className="text-[10px] opacity-60 uppercase tracking-widest">Toca para voltear</div>
                </div>
              </div>
            </div>
          </section>

          <section className="container-app mt-6 grid grid-cols-3 gap-3 text-center">
            <Stat label="Disponible" value={formatMXN(c.disponible)} />
            <Stat label="Usado" value={formatMXN(c.saldo_usado)} />
            <Stat label="Score" value={`${c.score}/100`} />
          </section>

          {c.fecha_limite_pago && c.saldo_usado > 0 && (
            <section className="container-app mt-4 text-xs text-muted-foreground">
              Fecha límite de pago: <span className="font-mono">{new Date(c.fecha_limite_pago).toLocaleDateString("es-MX")}</span>
            </section>
          )}

          <section className="container-app mt-6 space-y-4">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="text-sm font-semibold mb-2">Usar crédito</div>
              <p className="text-xs text-muted-foreground mb-3">El monto se acreditará a tu cuenta de banco.</p>
              <div className="flex gap-2">
                <input
                  type="number" inputMode="decimal" placeholder="0.00"
                  value={usarMonto} onChange={(e) => setUsarMonto(e.target.value)}
                  disabled={c.estado === "bloqueada"}
                  className="flex-1 rounded-xl bg-background border border-border px-3 py-3 font-mono"
                />
                <button
                  onClick={() => handle(() => fnUsar({ data: { monto: Number(usarMonto) } }), "Crédito usado")}
                  disabled={busy || !usarMonto || c.estado === "bloqueada"}
                  className="bmx-tap rounded-xl bg-primary text-primary-foreground px-5 font-semibold disabled:opacity-50"
                >Usar</button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="text-sm font-semibold mb-2">Pagar deuda</div>
              <p className="text-xs text-muted-foreground mb-3">Se descontará de tu saldo en banco.</p>
              <div className="flex gap-2">
                <input
                  type="number" inputMode="decimal" placeholder="0.00"
                  value={pagarMonto} onChange={(e) => setPagarMonto(e.target.value)}
                  className="flex-1 rounded-xl bg-background border border-border px-3 py-3 font-mono"
                />
                <button
                  onClick={() => handle(() => fnPagar({ data: { monto: Number(pagarMonto) } }), "Pago realizado")}
                  disabled={busy || !pagarMonto || c.saldo_usado <= 0}
                  className="bmx-tap rounded-xl bg-primary text-primary-foreground px-5 font-semibold disabled:opacity-50"
                >Pagar</button>
              </div>
              {c.saldo_usado > 0 && (
                <button
                  onClick={() => handle(() => fnPagar({ data: { monto: c.saldo_usado } }), "Deuda liquidada")}
                  disabled={busy}
                  className="mt-3 text-xs text-muted-foreground underline"
                >Pagar todo ({formatMXN(c.saldo_usado)})</button>
              )}
            </div>
          </section>
        </>
      )}
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
