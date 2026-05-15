import { useState } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  maxLen?: number;
}

/** 4 rows × 3 cols numeric keypad with decimal & backspace. value is a string of digits w/ optional dot. */
export function NumPad({ value, onChange, maxLen = 12 }: Props) {
  const press = (k: string) => {
    if (k === "back") return onChange(value.slice(0, -1));
    if (k === ".") {
      if (value.includes(".") || value.length === 0) return;
      return onChange(value + ".");
    }
    if (value.includes(".")) {
      const dec = value.split(".")[1] ?? "";
      if (dec.length >= 2) return;
    }
    if (value.replace(".", "").length >= maxLen) return;
    if (value === "0" && k !== ".") return onChange(k);
    onChange(value + k);
  };

  const keys: Array<{ k: string; label: React.ReactNode }> = [
    ...["1","2","3","4","5","6","7","8","9"].map((n) => ({ k: n, label: n })),
    { k: ".", label: "." },
    { k: "0", label: "0" },
    { k: "back", label: <BackIcon /> },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 select-none">
      {keys.map(({ k, label }) => (
        <button
          key={k}
          type="button"
          onClick={() => press(k)}
          className="bmx-tap h-14 rounded-2xl bg-surface text-foreground text-2xl font-medium font-mono active:bg-border flex items-center justify-center"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12l5-6h13v12H8z" /><path d="M11 9l4 6M15 9l-4 6" />
    </svg>
  );
}

export function useAmount(initial = "") {
  const [v, setV] = useState(initial);
  const num = v === "" || v === "." ? 0 : parseFloat(v);
  return { value: v, setValue: setV, number: num };
}
