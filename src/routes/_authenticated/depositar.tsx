import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { NumPad, useAmount } from "@/components/NumPad";
import { getMe } from "@/lib/usuario.functions";
import { depositar } from "@/lib/movimientos.functions";
import { formatMXN } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/depositar")({
  component: DepositarPage,
});

function DepositarPage() {
  const router = useRouter();
  const fetchMe = useServerFn(getMe);
  const fnDepositar = useServerFn(depositar);
  const { data } = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const { value, setValue, number } = useAmount();
  const [loading, setLoading] = useState(false);

  const max = data?.saldo_cartera ?? 0;
  const valid = number > 0 && number <= max;

  const submit = async () => {
    if (!valid || loading) return;
    setLoading(true);
    try {
      await fnDepositar({ data: { monto: number } });
      toast.success(`Depositaste ${formatMXN(number)} a tu cuenta`);
      router.invalidate();
      router.navigate({ to: "/home" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <ScreenHeader title="Depositar" />
      <div className="container-app mt-4 flex-1 flex flex-col">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Cartera disponible</div>
        <div className="font-mono text-sm">{formatMXN(max)}</div>

        <div className="flex-1 flex items-center justify-center py-8">
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Monto a depositar</div>
            <div className="font-mono text-5xl font-semibold tabular-nums">
              ${value || "0"}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">MXN — Cartera → Banco</div>
            {number > max && (
              <div className="text-xs text-destructive mt-3">Excede tu cartera</div>
            )}
          </div>
        </div>

        <NumPad value={value} onChange={setValue} />

        <button
          disabled={!valid || loading}
          onClick={submit}
          className="bmx-tap mt-4 mb-4 rounded-2xl bg-primary text-primary-foreground py-4 font-semibold disabled:opacity-40"
        >
          {loading ? "Procesando…" : "Confirmar depósito"}
        </button>
      </div>
    </div>
  );
}
