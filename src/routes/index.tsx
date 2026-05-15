import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/home" });
  },
  component: SplashRedirect,
});

function SplashRedirect() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 1800);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (done) window.location.replace("/login");
  }, [done]);

  return (
    <div className="fixed inset-0 bg-[#0A0A0A] flex items-center justify-center">
      <div className="text-white text-center">
        <div className="text-3xl font-bold tracking-tight">Banco De México</div>
        <div className="mt-2 text-xs uppercase tracking-[0.3em] text-white/50">BMX</div>
      </div>
    </div>
  );
}
