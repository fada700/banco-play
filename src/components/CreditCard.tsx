import { useState } from "react";
import { maskCardNumber, formatMXN } from "@/lib/format";

interface Props {
  numero: string;
  cvv: string;
  vencimiento: string;
  titular: string;
  limite: number;
  bloqueada: boolean;
}

export function CreditCard({ numero, cvv, vencimiento, titular, limite, bloqueada }: Props) {
  const [flipped, setFlipped] = useState(false);
  const bg = "bg-[linear-gradient(135deg,#5a5a5e_0%,#cfd1d6_30%,#8a8c92_55%,#3a3a3f_100%)]";
  return (
    <div className="flip-perspective">
      <div className={`flip-inner ${flipped ? "flipped" : ""} cursor-pointer`} onClick={() => setFlipped((f) => !f)}>
        <div className={`flip-face relative overflow-hidden ${bg} text-zinc-900 rounded-2xl p-5 aspect-[1.6/1] flex flex-col justify-between shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)]`}>
          {/* halftone */}
          <div className="absolute inset-0 opacity-[0.12] pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, #000 1px, transparent 1px)",
              backgroundSize: "6px 6px",
            }}
          />
          <div className="absolute -inset-y-12 -left-20 w-40 rotate-12 bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />

          <div className="flex justify-between items-start relative">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] font-bold">PlayBank</div>
              <div className="text-base font-bold mt-0.5">Platinum Credit</div>
            </div>
            {bloqueada ? (
              <div className="text-[10px] uppercase tracking-widest bg-black/30 text-white px-2 py-1 rounded-full">
                Bloqueada
              </div>
            ) : (
              <div className="opacity-90">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M8.5 8.5a3 3 0 0 1 5.66 0M6.5 6.5a6 6 0 0 1 11 0M10.5 10.5a1 1 0 0 1 3 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="12" cy="14.5" r="1" fill="currentColor" />
                </svg>
              </div>
            )}
          </div>

          <div className="relative h-8 w-11 rounded-md bg-gradient-to-br from-yellow-200 via-amber-400 to-yellow-600 shadow-inner overflow-hidden">
            <div className="absolute inset-1 border border-black/30 rounded-sm" />
            <div className="absolute inset-x-2 top-1/2 h-px bg-black/40" />
            <div className="absolute inset-y-1.5 left-1/2 w-px bg-black/40" />
          </div>

          <div className="relative font-mono text-[19px] tracking-[0.18em] font-semibold">
            {maskCardNumber(numero)}
          </div>

          <div className="relative flex justify-between items-end text-[11px]">
            <div>
              <div className="opacity-60 uppercase tracking-wider text-[9px]">Titular</div>
              <div className="font-semibold uppercase tracking-wide mt-0.5">{titular}</div>
            </div>
            <div>
              <div className="opacity-60 uppercase tracking-wider text-[9px]">Límite</div>
              <div className="font-mono mt-0.5">{formatMXN(limite)}</div>
            </div>
            <div>
              <div className="opacity-60 uppercase tracking-wider text-[9px]">Vence</div>
              <div className="font-mono mt-0.5">{vencimiento}</div>
            </div>
          </div>
        </div>

        <div className={`flip-face flip-face-back relative overflow-hidden ${bg} text-zinc-900 rounded-2xl aspect-[1.6/1] flex flex-col shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)]`}>
          <div className="h-10 bg-black/80 mt-4" />
          <div className="px-5 pt-4 flex-1 flex flex-col justify-between">
            <div className="bg-white/95 text-black rounded px-3 py-2 font-mono text-lg w-full max-w-[180px] self-end relative">
              <span className="opacity-50 text-[9px] uppercase tracking-widest absolute -top-3 right-0">CVV</span>
              {cvv}
            </div>
            <div className="text-[10px] opacity-70 uppercase tracking-widest pb-4">Toca para voltear</div>
          </div>
        </div>
      </div>
    </div>
  );
}
