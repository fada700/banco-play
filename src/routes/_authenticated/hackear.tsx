import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  escanearHackeo,
  ejecutarHackeo,
  comprarAntivirus,
  getHackeoEstado,
  type HackTarget,
  type HackResult,
} from "@/lib/hackeo.functions";
import { formatMXN } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/hackear")({
  component: HackearPage,
});

type Line = { id: number; text: string; tone?: "ok" | "err" | "warn" | "dim" };

function HackearPage() {
  const fnEstado = useServerFn(getHackeoEstado);
  const fnEscanear = useServerFn(escanearHackeo);
  const fnEjecutar = useServerFn(ejecutarHackeo);
  const fnAnti = useServerFn(comprarAntivirus);

  const { data: estado, refetch } = useQuery({
    queryKey: ["hackeo-estado"],
    queryFn: () => fnEstado(),
    staleTime: 5_000,
  });

  const [lines, setLines] = useState<Line[]>([]);
  const [targets, setTargets] = useState<HackTarget[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState<HackResult | null>(null);
  const lineIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, targets]);

  const push = (text: string, tone?: Line["tone"]) =>
    setLines((l) => [...l, { id: ++lineIdRef.current, text, tone }]);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const typeLines = async (msgs: Array<[string, Line["tone"]?]>, delay = 220) => {
    for (const [t, tone] of msgs) {
      push(t, tone);
      await sleep(delay);
    }
  };

  const cooldownActivo = (() => {
    if (!estado?.ultimo_hackeo) return null;
    const next = new Date(estado.ultimo_hackeo).getTime() + estado.cooldown_horas * 3600_000;
    const diff = next - Date.now();
    if (diff <= 0) return null;
    const h = Math.floor(diff / 3600_000);
    const m = Math.floor((diff % 3600_000) / 60_000);
    return `${h}h ${m}m`;
  })();

  const antivirusActivo = estado?.antivirus_hasta && new Date(estado.antivirus_hasta) > new Date()
    ? new Date(estado.antivirus_hasta).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })
    : null;

  const escanear = async () => {
    if (busy) return;
    setBusy(true);
    setResultado(null);
    setTargets(null);
    setLines([]);
    try {
      await typeLines([
        ["$ ./darknet --init", "dim"],
        ["[+] connecting to mesh node ...", "dim"],
        ["[+] handshake OK", "ok"],
        ["[+] purchasing exploit kit ...", "warn"],
      ]);
      const data = await fnEscanear();
      await typeLines([
        [`[+] kit deployed (-${formatMXN(estado?.costo_kit ?? 0)})`, "ok"],
        ["[+] scanning subnet 10.0.0.0/8 ...", "dim"],
        ["[+] bypassing firewalls ...", "dim"],
        [`[+] ${data.length} target(s) found`, "ok"],
        ["", "dim"],
        ["select_target> _", "warn"],
      ], 180);
      setTargets(data);
      void refetch();
    } catch (e) {
      push(`[!] ${(e as Error).message}`, "err");
    } finally {
      setBusy(false);
    }
  };

  const elegir = async (t: HackTarget) => {
    if (busy) return;
    setBusy(true);
    setTargets(null);
    try {
      await typeLines([
        [`> target locked: ${t.nombre_mask} (${t.cliente_mask})`, "warn"],
        [`> card: **** **** **** ${t.tarjeta.slice(-4)}`, "dim"],
        [`> cvv: ${t.cvv}  exp: ${t.vencimiento}`, "dim"],
        ["[+] injecting payload ...", "dim"],
        ["[+] bypassing 2FA ...", "dim"],
        ["[+] draining account ...", "warn"],
      ]);
      const r = await fnEjecutar({ data: { victima_id: t.id } });
      setResultado(r);
      if (r.exito) {
        await typeLines([
          [`[✓] SUCCESS — extracted ${formatMXN(r.bruto ?? 0)}`, "ok"],
          [`[i] network fee: ${formatMXN(r.comision ?? 0)}`, "dim"],
          [`[$] net to wallet: ${formatMXN(r.monto)}`, "ok"],
        ], 250);
      } else if (r.razon === "antivirus") {
        await typeLines([
          ["[X] TARGET PROTECTED", "err"],
          ["[X] Antivirus enterprise edition detected", "err"],
          ["[X] kit consumed, no funds extracted", "err"],
        ], 250);
      } else {
        await typeLines([
          ["[X] FIREWALL TRIGGERED", "err"],
          ["[X] connection terminated", "err"],
          ["[X] kit consumed, no funds extracted", "err"],
        ], 250);
      }
    } catch (e) {
      push(`[!] ${(e as Error).message}`, "err");
    } finally {
      setBusy(false);
      void refetch();
    }
  };

  const comprarAnti = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fnAnti();
      toast.success("Antivirus activado por 7 días");
      void refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-emerald-400 font-mono">
      <header className="flex items-center justify-between px-4 py-3 border-b border-emerald-900/50">
        <div>
          <div className="text-[10px] text-emerald-700 uppercase tracking-widest">darknet/v2.1</div>
          <div className="text-sm text-emerald-300">// hack_terminal</div>
        </div>
        <Link to="/home" className="text-xs text-emerald-700 hover:text-emerald-400">[exit]</Link>
      </header>

      <section className="px-4 pt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="border border-emerald-900/50 rounded p-2">
          <div className="text-emerald-700 uppercase tracking-widest text-[9px]">kit</div>
          <div>{formatMXN(estado?.costo_kit ?? 0)}</div>
        </div>
        <div className="border border-emerald-900/50 rounded p-2">
          <div className="text-emerald-700 uppercase tracking-widest text-[9px]">cooldown</div>
          <div>{cooldownActivo ? <span className="text-amber-400">{cooldownActivo}</span> : "listo"}</div>
        </div>
        <div className="border border-emerald-900/50 rounded p-2">
          <div className="text-emerald-700 uppercase tracking-widest text-[9px]">antivirus</div>
          <div>{antivirusActivo ? <span className="text-cyan-400">hasta {antivirusActivo}</span> : "off"}</div>
        </div>
        <div className="border border-emerald-900/50 rounded p-2">
          <div className="text-emerald-700 uppercase tracking-widest text-[9px]">banco</div>
          <div>{formatMXN(estado?.saldo_banco ?? 0)}</div>
        </div>
      </section>

      <div
        ref={scrollRef}
        className="mx-4 mt-3 h-[42vh] overflow-y-auto rounded border border-emerald-900/50 bg-emerald-950/10 p-3 text-[12px] leading-relaxed"
      >
        {lines.length === 0 && !targets && (
          <div className="text-emerald-700">
            $ &gt; awaiting command_<span className="bmx-blink">▌</span>
          </div>
        )}
        {lines.map((l) => (
          <div
            key={l.id}
            className={
              l.tone === "ok" ? "text-emerald-300"
              : l.tone === "err" ? "text-red-400"
              : l.tone === "warn" ? "text-amber-400"
              : "text-emerald-700"
            }
          >
            {l.text || "\u00A0"}
          </div>
        ))}

        {targets && (
          <div className="mt-3 space-y-2">
            {targets.map((t, i) => (
              <button
                key={t.id}
                disabled={busy}
                onClick={() => elegir(t)}
                className="w-full text-left rounded border border-emerald-700/60 hover:border-emerald-400 hover:bg-emerald-500/10 p-2 transition disabled:opacity-40"
              >
                <div className="flex justify-between text-emerald-300">
                  <span>[{i + 1}] {t.nombre_mask}</span>
                  <span className="text-amber-400">~{formatMXN(t.saldo_aprox)}</span>
                </div>
                <div className="text-emerald-700 text-[10px]">cliente {t.cliente_mask}</div>
                <div className="text-emerald-700 text-[10px] font-mono">
                  card •••• {t.tarjeta.slice(-4)} · cvv {t.cvv} · exp {t.vencimiento}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 mt-3 flex gap-2">
        <button
          onClick={escanear}
          disabled={busy || !!cooldownActivo}
          className="flex-1 bmx-tap rounded border-2 border-emerald-500 bg-emerald-500/10 text-emerald-300 py-3 text-xs uppercase tracking-widest hover:bg-emerald-500/20 disabled:opacity-30 disabled:border-emerald-900"
        >
          {busy ? "running..." : cooldownActivo ? `wait ${cooldownActivo}` : "▶ run exploit"}
        </button>
        <button
          onClick={comprarAnti}
          disabled={busy || !!antivirusActivo}
          className="bmx-tap rounded border-2 border-cyan-700 text-cyan-300 px-4 py-3 text-xs uppercase tracking-widest hover:bg-cyan-500/10 disabled:opacity-30"
        >
          {antivirusActivo ? "✓ AV" : `AV ${formatMXN(estado?.costo_antivirus ?? 0)}`}
        </button>
      </div>

      {resultado?.exito && (
        <div className="mx-4 mt-4 rounded border border-emerald-500 bg-emerald-500/10 p-3 text-emerald-300 text-sm">
          <div className="text-[10px] uppercase tracking-widest text-emerald-600">payout</div>
          <div className="font-mono text-xl mt-1">+{formatMXN(resultado.monto)}</div>
          <div className="text-[10px] text-emerald-700 mt-1">depositado en tu cartera</div>
        </div>
      )}

      <div className="px-4 mt-4 pb-8 text-[10px] text-emerald-800 leading-relaxed">
        // 1 uso cada {estado?.cooldown_horas ?? 48}h. Si falla pierdes el kit. 10% comisión del banco. Membresía Plus/Black aumenta defensa.
      </div>
    </div>
  );
}
