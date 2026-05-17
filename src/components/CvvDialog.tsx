import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { verificarCvv } from "@/lib/movimientos.functions";
import { toast } from "sonner";

interface Props {
  open: boolean;
  monto: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function CvvDialog({ open, monto, onClose, onSuccess }: Props) {
  const fnCvv = useServerFn(verificarCvv);
  const [cvv, setCvv] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (open) { setCvv(""); setAttempts(0); }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (cvv.length !== 3 || busy) return;
    setBusy(true);
    try {
      await fnCvv({ data: { cvv } });
      onSuccess();
    } catch (e) {
      const next = attempts + 1;
      setAttempts(next);
      setCvv("");
      toast.error((e as Error).message);
      if (next >= 3) {
        toast.error("Demasiados intentos. Operación cancelada.");
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-background w-full sm:max-w-sm sm:rounded-2xl rounded-t-3xl p-6 border-t sm:border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Verificación de seguridad</div>
        <h2 className="text-xl font-bold mt-1">Ingresa tu CVV</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Por monto superior a <span className="font-mono">$35,000</span>, confirma con el CVV de tu tarjeta de débito (reverso).
        </p>

        <input
          autoFocus
          type="password"
          inputMode="numeric"
          pattern="\d{3}"
          maxLength={3}
          value={cvv}
          onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 3))}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="•••"
          className="mt-5 w-full text-center font-mono text-4xl tracking-[0.5em] bg-surface rounded-2xl py-4 outline-none focus:ring-2 focus:ring-foreground/30"
        />

        <div className="text-[11px] text-muted-foreground mt-2 text-center">
          Intentos restantes: {3 - attempts}
        </div>

        <div className="grid grid-cols-2 gap-3 mt-6">
          <button
            onClick={onClose}
            className="bmx-tap rounded-xl border border-border py-3 text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={cvv.length !== 3 || busy}
            className="bmx-tap rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold disabled:opacity-40"
          >
            {busy ? "Verificando…" : "Confirmar"}
          </button>
        </div>

        <div className="text-[10px] text-muted-foreground mt-4 text-center">
          Monto a proteger: <span className="font-mono">${monto.toLocaleString("es-MX")}</span>
        </div>
      </div>
    </div>
  );
}
