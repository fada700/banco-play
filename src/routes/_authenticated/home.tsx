import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getMe } from "@/lib/usuario.functions";
import { formatMXN, maskCardNumber, greetingByHour } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
});

function HomePage() {
  const fetchMe = useServerFn(getMe);
  const { data, isLoading, error } = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });

  const [hideCartera, setHideCartera] = useState(false);
  const [hideBanco, setHideBanco] = useState(false);
  const [flipped, setFlipped] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground bmx-pulse">
        Cargando…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-destructive p-6 text-center">
        {(error as Error)?.message ?? "Error al cargar"}
      </div>
    );
  }

  const card = data.tarjeta_debito;

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <header className="container-app pt-6 flex items-center justify-between">
        <div>
          <div className="text-base font-bold tracking-tight">Banco De México</div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">BMX</div>
        </div>
        <div className="flex items-center gap-3">
          {data.discord_avatar_url ? (
            <img src={data.discord_avatar_url} alt="" className="h-9 w-9 rounded-full border border-border" />
          ) : (
            <div className="h-9 w-9 rounded-full bg-secondary" />
          )}
        </div>
      </header>

      {/* Greeting */}
      <section className="container-app mt-6">
        <h1 className="text-2xl font-bold">{greetingByHour(data.nombre.split(" ")[0])}</h1>
        <p className="text-sm text-muted-foreground">Cliente {data.numero_cliente}</p>
      </section>

      {/* Saldos */}
      <section className="container-app mt-5 space-y-3">
        <BalanceCard
          label="Cartera"
          subtitle="En la calle"
          amount={data.saldo_cartera}
          hidden={hideCartera}
          onToggle={() => setHideCartera((v) => !v)}
        />
        <BalanceCard
          label="Banco"
          subtitle="Disponible en cuenta"
          amount={data.saldo_banco}
          hidden={hideBanco}
          onToggle={() => setHideBanco((v) => !v)}
        />
      </section>

      {/* Tarjeta débito */}
      {card && (
        <section className="container-app mt-5">
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
                  <div className="text-xs opacity-70">{card.congelada ? "● Congelada" : ""}</div>
                </div>
                <div className="font-mono text-lg tracking-widest">{maskCardNumber(card.numero)}</div>
                <div className="flex justify-between items-end text-xs">
                  <div>
                    <div className="opacity-50 uppercase">Titular</div>
                    <div className="font-medium uppercase">{data.nombre}</div>
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
        </section>
      )}

      {/* Acciones */}
      <section className="container-app mt-5 grid grid-cols-3 gap-3">
        {[
          { label: "Depositar" },
          { label: "Retirar" },
          { label: "Transferir" },
        ].map((a) => (
          <button
            key={a.label}
            className="bmx-tap rounded-2xl bg-primary text-primary-foreground py-4 text-sm font-semibold"
            onClick={() => alert(`${a.label} — disponible en la siguiente fase`)}
          >
            {a.label}
          </button>
        ))}
      </section>

      {/* Movimientos */}
      <section className="container-app mt-7">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Últimos movimientos</h2>
          <span className="text-xs text-muted-foreground">Recientes</span>
        </div>
        <div className="mt-3 rounded-2xl border border-border bg-surface divide-y divide-border">
          {data.ultimos_movimientos.length === 0 && (
            <div className="p-5 text-sm text-muted-foreground text-center">Sin movimientos aún</div>
          )}
          {data.ultimos_movimientos.map((m) => {
            const isIn = ["deposito", "transferencia_recibida", "admin_dar"].includes(m.tipo);
            return (
              <div key={m.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{m.descripcion}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(m.fecha).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <div className={`font-mono text-sm ${isIn ? "text-money-in" : "text-money-out"}`}>
                  {isIn ? "+" : "−"}{formatMXN(m.monto)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Logout */}
      <div className="container-app mt-8 text-center">
        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.replace("/login"); }}
          className="text-xs text-muted-foreground underline"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

function BalanceCard({
  label, subtitle, amount, hidden, onToggle,
}: { label: string; subtitle: string; amount: number; hidden: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className="text-[11px] text-muted-foreground">{subtitle}</div>
        </div>
        <button onClick={onToggle} className="bmx-tap text-xs text-muted-foreground underline">
          {hidden ? "Mostrar" : "Ocultar"}
        </button>
      </div>
      <div className="mt-3 font-mono text-3xl font-semibold">
        {hidden ? "••••••" : formatMXN(amount)} <span className="text-xs font-sans text-muted-foreground">MXN</span>
      </div>
    </div>
  );
}
