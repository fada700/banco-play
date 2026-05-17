import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getMe } from "@/lib/usuario.functions";
import { toggleTarjeta } from "@/lib/movimientos.functions";
import { formatMXN } from "@/lib/format";
import { DebitCard } from "@/components/DebitCard";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tarjetas")({
  component: TarjetasPage,
});

function TarjetasPage() {
  const qc = useQueryClient();
  const fetchMe = useServerFn(getMe);
  const fnToggle = useServerFn(toggleTarjeta);
  const { data, isLoading } = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const [busy, setBusy] = useState(false);
  // flipped state handled inside DebitCard now

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
          <DebitCard
            numero={card.numero}
            cvv={card.cvv}
            vencimiento={card.vencimiento}
            titular={data?.nombre ?? ""}
            congelada={card.congelada}
            membresia={data?.membresia ?? "basica"}
          />
        )}

        {card && (
          <div className="mt-4">
            <button
              onClick={onToggle}
              disabled={busy}
              className="bmx-tap w-full rounded-2xl border border-border py-3 text-sm font-medium disabled:opacity-50"
            >
              {card.congelada ? "Descongelar tarjeta" : "Congelar tarjeta"}
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
