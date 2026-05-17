import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { NumPad, useAmount } from "@/components/NumPad";
import { CvvDialog } from "@/components/CvvDialog";
import { getMe } from "@/lib/usuario.functions";
import { transferir } from "@/lib/movimientos.functions";
import { formatMXN } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/transferir")({
  component: TransferirPage,
});

const COMISION_DEFAULT = 2; // visual fallback; backend usa el real
const UMBRAL_CVV = 35_000;

function TransferirPage() {
  const router = useRouter();
  const fetchMe = useServerFn(getMe);
  const fnTransferir = useServerFn(transferir);
  const { data } = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });

  const [step, setStep] = useState<"destino" | "monto" | "confirmar">("destino");
  const [destino, setDestino] = useState("");
  const [concepto, setConcepto] = useState("");
  const { value, setValue, number } = useAmount();
  const [loading, setLoading] = useState(false);
  const [cvvOpen, setCvvOpen] = useState(false);

  const max = data?.saldo_banco ?? 0;
  const comision = +(number * (COMISION_DEFAULT / 100)).toFixed(2);
  const total = number + comision;
  const validMonto = number > 0 && total <= max;
  const requiereCvv = number > UMBRAL_CVV;

  const doTransfer = async () => {
    setLoading(true);
    try {
      const r = await fnTransferir({
        data: { destino: destino.trim(), monto: number, concepto: concepto.trim() || undefined },
      });
      toast.success(`Enviaste ${formatMXN(r.monto)} a ${r.destino_nombre}`);
      router.invalidate();
      router.navigate({ to: "/home" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!validMonto || loading || destino.length === 0) return;
    if (requiereCvv) { setCvvOpen(true); return; }
    await doTransfer();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <ScreenHeader title="Transferir" />

      {step === "destino" && (
        <div className="container-app mt-6 flex-1 flex flex-col">
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Número de cliente destino</label>
          <input
            value={destino}
            onChange={(e) => setDestino(e.target.value.toUpperCase())}
            placeholder="BMX-000000"
            autoFocus
            className="mt-2 font-mono text-2xl bg-surface rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-foreground/20 tracking-widest"
          />

          <label className="mt-6 text-xs uppercase tracking-widest text-muted-foreground">Concepto (opcional)</label>
          <input
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder="Pago de…"
            maxLength={80}
            className="mt-2 bg-surface rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-foreground/20"
          />

          <div className="flex-1" />

          <button
            disabled={destino.length < 3}
            onClick={() => setStep("monto")}
            className="bmx-tap mt-4 mb-4 rounded-2xl bg-primary text-primary-foreground py-4 font-semibold disabled:opacity-40"
          >
            Continuar
          </button>
        </div>
      )}

      {step === "monto" && (
        <div className="container-app mt-4 flex-1 flex flex-col">
          <div className="flex items-center justify-between text-xs">
            <span className="uppercase tracking-widest text-muted-foreground">Para</span>
            <span className="font-mono">{destino}</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="uppercase tracking-widest text-muted-foreground">Banco disponible</span>
            <span className="font-mono">{formatMXN(max)}</span>
          </div>

          <div className="flex-1 flex items-center justify-center py-8">
            <div className="text-center">
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Monto</div>
              <div className="font-mono text-5xl font-semibold tabular-nums">
                ${value || "0"}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                Comisión {COMISION_DEFAULT}% · Total {formatMXN(total)}
              </div>
              {!validMonto && number > 0 && (
                <div className="text-xs text-destructive mt-3">Excede tu saldo (con comisión)</div>
              )}
            </div>
          </div>

          <NumPad value={value} onChange={setValue} />

          <button
            disabled={!validMonto || loading}
            onClick={() => setStep("confirmar")}
            className="bmx-tap mt-4 mb-4 rounded-2xl bg-primary text-primary-foreground py-4 font-semibold disabled:opacity-40"
          >
            Revisar
          </button>
        </div>
      )}

      {step === "confirmar" && (
        <div className="container-app mt-6 flex-1 flex flex-col">
          <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
            <Row k="Para" v={destino} mono />
            {concepto && <Row k="Concepto" v={concepto} />}
            <Row k="Monto" v={formatMXN(number)} mono />
            <Row k="Comisión" v={formatMXN(comision)} mono />
            <div className="border-t border-border pt-4">
              <Row k="Total a debitar" v={formatMXN(total)} mono bold />
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground text-center mt-4">
            Esta operación es inmediata e irreversible.
          </p>

          <div className="flex-1" />

          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => setStep("monto")}
              className="bmx-tap rounded-2xl border border-border py-4 font-medium"
            >
              Atrás
            </button>
            <button
              disabled={loading}
              onClick={submit}
              className="bmx-tap rounded-2xl bg-primary text-primary-foreground py-4 font-semibold disabled:opacity-40"
            >
              {loading ? "Enviando…" : "Confirmar"}
            </button>
          </div>
        </div>
      )}

      <CvvDialog
        open={cvvOpen}
        monto={number}
        onClose={() => setCvvOpen(false)}
        onSuccess={() => { setCvvOpen(false); void doTransfer(); }}
      />
    </div>
  );
}

function Row({ k, v, mono, bold }: { k: string; v: string; mono?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className={`${mono ? "font-mono" : ""} ${bold ? "font-semibold text-base" : ""}`}>{v}</span>
    </div>
  );
}
