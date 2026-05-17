import { useState } from "react";
import { maskCardNumber } from "@/lib/format";

interface Props {
  numero: string;
  cvv: string;
  vencimiento: string;
  titular: string;
  congelada: boolean;
  membresia?: "basica" | "plus" | "black";
}

const VARIANT: Record<NonNullable<Props["membresia"]>, { bg: string; chip: string; label: string }> = {
  basica: {
    bg: "bg-[linear-gradient(135deg,#b21217_0%,#7a0a0e_50%,#4a0608_100%)]",
    chip: "from-yellow-300 via-amber-400 to-yellow-600",
    label: "Classic",
  },
  plus: {
    bg: "bg-[linear-gradient(135deg,#0a0a0a_0%,#1a1a1a_50%,#000_100%)]",
    chip: "from-yellow-300 via-amber-400 to-yellow-600",
    label: "Plus",
  },
  black: {
    bg: "bg-[linear-gradient(135deg,#1a1a1a_0%,#0a0a0a_50%,#000_100%)]",
    chip: "from-amber-200 via-yellow-500 to-amber-700",
    label: "Black",
  },
};

export function DebitCard({ numero, cvv, vencimiento, titular, congelada, membresia = "basica" }: Props) {
  const [flipped, setFlipped] = useState(false);
  const v = VARIANT[membresia];
  return (
    <div className="flip-perspective">
      <div
        className={`flip-inner ${flipped ? "flipped" : ""} cursor-pointer`}
        onClick={() => setFlipped((f) => !f)}
      >
        {/* FRONT */}
        <div
          className={`flip-face relative overflow-hidden ${v.bg} text-white rounded-2xl p-5 aspect-[1.6/1] flex flex-col justify-between shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]`}
        >
          {/* texture */}
          <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, white 0 1px, transparent 1px 7px)",
            }}
          />
          {/* shine */}
          <div className="absolute -inset-y-12 -left-20 w-32 rotate-12 bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

          {membresia === "plus" && (
            <div className="absolute right-6 top-0 bottom-0 flex">
              <div className="w-1.5 bg-[#006847]" />
              <div className="w-1.5 bg-white" />
              <div className="w-1.5 bg-[#ce1126]" />
            </div>
          )}

          <div className="flex justify-between items-start relative">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] opacity-80 font-semibold">PlayBank</div>
              <div className="text-base font-bold mt-0.5">{v.label}</div>
            </div>
            {congelada ? (
              <div className="text-[10px] uppercase tracking-widest bg-white/20 backdrop-blur px-2 py-1 rounded-full">
                Congelada
              </div>
            ) : (
              <div className="opacity-90">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M8.5 8.5a3 3 0 0 1 5.66 0M6.5 6.5a6 6 0 0 1 11 0M10.5 10.5a1 1 0 0 1 3 0" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="12" cy="14.5" r="1" fill="white" />
                </svg>
              </div>
            )}
          </div>

          <div className="relative flex items-center gap-3 -mt-2">
            <div className={`h-8 w-11 rounded-md bg-gradient-to-br ${v.chip} relative overflow-hidden shadow-inner`}>
              <div className="absolute inset-1 border border-black/30 rounded-sm" />
              <div className="absolute inset-x-2 top-1/2 h-px bg-black/40" />
              <div className="absolute inset-y-1.5 left-1/2 w-px bg-black/40" />
            </div>
          </div>

          <div className="relative font-mono text-[19px] tracking-[0.18em] font-semibold drop-shadow">
            {maskCardNumber(numero)}
          </div>

          <div className="relative flex justify-between items-end text-[11px]">
            <div>
              <div className="opacity-60 uppercase tracking-wider text-[9px]">Titular</div>
              <div className="font-semibold uppercase tracking-wide mt-0.5">{titular}</div>
            </div>
            <div>
              <div className="opacity-60 uppercase tracking-wider text-[9px]">Vence</div>
              <div className="font-mono mt-0.5">{vencimiento}</div>
            </div>
            <div className="text-right">
              <div className="font-black italic text-base tracking-tight text-white/95">VISA</div>
              <div className="text-[8px] uppercase tracking-widest opacity-70">{v.label}</div>
            </div>
          </div>
        </div>

        {/* BACK */}
        <div className={`flip-face flip-face-back relative overflow-hidden ${v.bg} text-white rounded-2xl aspect-[1.6/1] flex flex-col shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]`}>
          <div className="h-10 bg-black/80 mt-4" />
          <div className="px-5 pt-4 flex-1 flex flex-col justify-between">
            <div className="bg-white/95 text-black rounded px-3 py-2 font-mono text-lg w-full max-w-[180px] self-end relative">
              <span className="opacity-50 text-[9px] uppercase tracking-widest absolute -top-3 right-0">CVV</span>
              {cvv}
            </div>
            <div className="text-[10px] opacity-70 uppercase tracking-widest pb-4">
              Toca para voltear
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
