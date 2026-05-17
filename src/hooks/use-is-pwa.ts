import { useEffect, useState } from "react";

/**
 * Detects whether the app is running as an installed PWA (standalone).
 * Returns null while undetermined (SSR), then true/false.
 */
export function useIsPwa(): boolean | null {
  const [isPwa, setIsPwa] = useState<boolean | null>(null);
  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsPwa(!!standalone);
  }, []);
  return isPwa;
}
