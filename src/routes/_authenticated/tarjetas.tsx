import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getMe } from "@/lib/usuario.functions";
import { toggleTarjeta } from "@/lib/movimientos.functions";
import { maskCardNumber, formatMXN } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tarjetas")({
  component: TarjetasPage,
});

function TarjetasPage() {
  const qc = useQueryClient();
  const fetchMe = useServerFn(getMe);
  const fnToggle = useServerFn(toggleTarjeta);
  const { data, isLoading } = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);

  const card = data?.tarjeta_debito;

  const onToggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fnToggle({});
      toast.success(r.congelada ? "Tarjeta congelada" : "Tarjeta activa");
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="container-app pt-6">
        <h1 className="text-2xl font-bold">Tarjetas</h1>
        <p className="text-sm text-muted-foreground">Tu débito y crédito</p>
      </header>

      <section className="container-app mt-6">
        <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">Débito</div>
        {isLoading || !card ? (
          <div className="rounded-2xl bg-surface aspect-[1.6/1] bmx-pulse" />
        ) : (
          <div className="flip-perspective">
            <div
              className={`flip-inner ${flipped ? "flipped" : ""} cursor-pointer`}
              onClick={() => setFlipped((v) => !v)}
            >
              <div className="flip-face bg-card-debit text-card-debit-foreground rounded-2xl p-5 aspect-[1.6/1] flex flex-col justify-between shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs uppercase tracking-widest opacity-70">Débito</div>
                    <div className="text-sm font-semibold mt-1">Banco De México</div>
                  </div>
                  {card.congelada && (
                    <div className="text-[10px] uppercase tracking-widest bg-white/15 px-2 py-1 rounded-full">
                      Congelada
                    </div>
                  )}
                </div>
                <div className="font-mono text-lg tracking-widest">{maskCardNumber(card.numero)}</div>
                <div className="flex justify-between items-end text-xs">
                  <div>
                    <div className="opacity-50 uppercase">Titular</div>
                    <div className="font-medium uppercase">{data?.nombre}</div>
                  </div>
                  <div>
                    <div className="opacity-50 uppercase">Vence</div>
                    <div className="font-mono">{card.vencimiento}</div>
                  </div>
                </div>
              </div>
              <div className="flip-face flip-face-back bg-card-debit text-card-debit-foreground rounded-2xl p-5 aspect-[1.6/1] flex flex-col justify-between shadow-lg">
                <div className="h-10 -mx-5 bg-black/60 mt-3" />
                <div className="bg-white/90 text-black rounded px-3 py-2 font-mono text-lg w-32 self-end">
                  {card.cvv}
                </div>
                <div className="text-[10px] opacity-60 uppercase tracking-widest">CVV — Toca para voltear</div>
              </div>
            </div>
          </div>
        )}

        {card && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={onToggle}
              disabled={busy}
              className="bmx-tap rounded-2xl border border-border py-3 text-sm font-medium disabled:opacity-50"
            >
              {card.congelada ? "Descongelar" : "Congelar"}
            </button>
            <button
              onClick={() => setFlipped((v) => !v)}
              className="bmx-tap rounded-2xl border border-border py-3 text-sm font-medium"
            >
              Ver CVV
            </button>
          </div>
        )}
      </section>

      <section className="container-app mt-8">
        <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">Crédito</div>
        <Link to="/credito" className="block rounded-2xl border border-dashed border-border p-6 text-center bmx-tap">
          <div className="text-sm font-medium">Tarjeta de crédito</div>
          <div className="text-xs text-muted-foreground mt-1">Solicítala, úsala y págala desde aquí.</div>
          <div className="text-xs text-foreground/80 underline mt-3">Abrir →</div>
        </Link>
      </section>

      {data && (
        <div className="container-app mt-6 text-xs text-muted-foreground">
          Saldo en banco: <span className="font-mono">{formatMXN(data.saldo_banco)}</span>
        </div>
      )}
    </div>
  );
}
