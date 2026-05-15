import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listarMovimientos, esEntrada, type Movimiento } from "@/lib/movimientos.functions";
import { formatMXN } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/historial")({
  component: HistorialPage,
});

type Filtro = "todos" | "entradas" | "salidas";

function HistorialPage() {
  const fn = useServerFn(listarMovimientos);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const { data, isLoading } = useQuery({
    queryKey: ["movimientos", filtro],
    queryFn: () => fn({ data: { filtro } }),
  });

  const grupos = useMemo(() => agruparPorDia(data ?? []), [data]);

  return (
    <div className="min-h-screen">
      <header className="container-app pt-6">
        <h1 className="text-2xl font-bold">Movimientos</h1>
        <p className="text-sm text-muted-foreground">Historial de tu cuenta</p>
      </header>

      <div className="container-app mt-5 flex gap-2">
        {(["todos", "entradas", "salidas"] as Filtro[]).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`bmx-tap rounded-full px-4 py-2 text-xs font-medium border ${
              filtro === f
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border"
            }`}
          >
            {f === "todos" ? "Todos" : f === "entradas" ? "Entradas" : "Salidas"}
          </button>
        ))}
      </div>

      <div className="container-app mt-5 space-y-5">
        {isLoading && (
          <div className="text-center text-muted-foreground bmx-pulse py-12 text-sm">Cargando…</div>
        )}
        {!isLoading && grupos.length === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">
            Sin movimientos.
            <div className="mt-3">
              <Link to="/depositar" className="underline">Hacer un depósito</Link>
            </div>
          </div>
        )}
        {grupos.map(([dia, movs]) => (
          <div key={dia}>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2 px-1">{dia}</div>
            <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
              {movs.map((m) => {
                const entrada = esEntrada(m.tipo);
                return (
                  <div key={m.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{m.descripcion}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {labelTipo(m.tipo)} · {new Date(m.fecha).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <div className={`font-mono text-sm whitespace-nowrap ${entrada ? "text-money-in" : "text-money-out"}`}>
                      {entrada ? "+" : "−"}{formatMXN(m.monto)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function agruparPorDia(arr: Movimiento[]): Array<[string, Movimiento[]]> {
  const map = new Map<string, Movimiento[]>();
  for (const m of arr) {
    const d = new Date(m.fecha);
    const key = etiquetaDia(d);
    const list = map.get(key) ?? [];
    list.push(m);
    map.set(key, list);
  }
  return [...map.entries()];
}

function etiquetaDia(d: Date): string {
  const hoy = new Date();
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, hoy)) return "Hoy";
  if (same(d, ayer)) return "Ayer";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
}

const LABELS: Record<string, string> = {
  deposito: "Depósito",
  retiro: "Retiro",
  transferencia_enviada: "Transferencia enviada",
  transferencia_recibida: "Transferencia recibida",
  comision: "Comisión",
  pago_credito: "Pago de crédito",
  uso_credito: "Uso de crédito",
  interes_credito: "Interés crédito",
  membresia: "Membresía",
  admin_dar: "Ingreso (admin)",
  admin_quitar: "Cargo (admin)",
  condonacion: "Condonación",
  ganancia_banco: "Ganancia banco",
};
function labelTipo(t: string): string {
  return LABELS[t] ?? t;
}
