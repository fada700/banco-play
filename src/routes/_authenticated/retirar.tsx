import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { NumPad, useAmount } from "@/components/NumPad";
import { CvvDialog } from "@/components/CvvDialog";
import { getMe } from "@/lib/usuario.functions";
import { retirar } from "@/lib/movimientos.functions";
import { formatMXN } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/retirar")({
  component: RetirarPage,
});

const UMBRAL_CVV = 35_000;

function RetirarPage() {
  const router = useRouter();
  const fetchMe = useServerFn(getMe);
  const fnRetirar = useServerFn(retirar);
  const { data } = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const { value, setValue, number } = useAmount();
  const [loading, setLoading] = useState(false);
  const [cvvOpen, setCvvOpen] = useState(false);

  const max = data?.saldo_banco ?? 0;
  const valid = number > 0 && number <= max;
  const requiereCvv = number > UMBRAL_CVV;

  const doRetiro = async () => {
    setLoading(true);
    try {
      await fnRetirar({ data: { monto: number } });
      toast.success(`Retiraste ${formatMXN(number)} a tu cartera`);
      router.invalidate();
      router.navigate({ to: "/home" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!valid || loading) return;
    if (requiereCvv) { setCvvOpen(true); return; }
    await doRetiro();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <ScreenHeader title="Retirar" />
      <div className="container-app mt-4 flex-1 flex flex-col">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Banco disponible</div>
        <div className="font-mono text-sm">{formatMXN(max)}</div>

        <div className="flex-1 flex items-center justify-center py-8">
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Monto a retirar</div>
            <div className="font-mono text-5xl font-semibold tabular-nums">${value || "0"}</div>
            <div className="text-[11px] text-muted-foreground mt-1">MXN — Banco → Cartera</div>
            {requiereCvv && (
              <div className="text-[11px] text-amber-600 mt-2">Requiere verificación con CVV</div>
            )}
            {number > max && (
              <div className="text-xs text-destructive mt-3">Excede tu saldo en banco</div>
            )}
          </div>
        </div>

        <NumPad value={value} onChange={setValue} />

        <button
          disabled={!valid || loading}
          onClick={submit}
          className="bmx-tap mt-4 mb-4 rounded-2xl bg-primary text-primary-foreground py-4 font-semibold disabled:opacity-40"
        >
          {loading ? "Procesando…" : "Confirmar retiro"}
        </button>
      </div>

      <CvvDialog
        open={cvvOpen}
        monto={number}
        onClose={() => setCvvOpen(false)}
        onSuccess={() => { setCvvOpen(false); void doRetiro(); }}
      />
    </div>
  );
}
