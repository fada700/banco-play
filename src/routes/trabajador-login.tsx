import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOAuthUrl } from "@/lib/auth.functions";

export const Route = createFileRoute("/trabajador-login")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/trabajador-panel" });
  },
  component: TrabajadorLoginPage,
});

function TrabajadorLoginPage() {
  const getUrl = useServerFn(getOAuthUrl);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handle = async () => {
    setBusy(true);
    setErr(null);
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      sessionStorage.setItem("bmx_post_login_redirect", "/trabajador-panel");
      const { url } = await getUrl({ data: { redirectUri } });
      window.location.href = url;
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="container-app flex-1 flex flex-col justify-between py-12">
        <div className="pt-16">
          <div className="text-[10px] uppercase tracking-[0.4em] text-amber-600 font-bold">Acceso staff</div>
          <div className="text-2xl font-bold tracking-tight mt-2">Panel Trabajador</div>
          <div className="mt-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">BMX · Staff</div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-amber-600/40 bg-amber-600/5 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-700 mb-2">Política de seguridad</div>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              <li>• Verificación por Discord + código vía DM.</li>
              <li>• Solo cuentas con rol <span className="text-foreground font-medium">trabajador</span> (o admin) pueden entrar.</li>
              <li>• El panel <span className="text-foreground font-medium">no funciona dentro de la app instalada (PWA)</span>. Úsalo en navegador.</li>
            </ul>
          </div>

          <h1 className="text-2xl font-bold leading-tight">Inicia sesión como trabajador</h1>

          <button
            onClick={handle}
            disabled={busy}
            className="bmx-tap w-full bg-primary text-primary-foreground rounded-xl py-4 font-semibold disabled:opacity-50"
          >
            {busy ? "Conectando…" : "Continuar con Discord"}
          </button>
          {err && <p className="text-sm text-destructive">{err}</p>}

          <div className="text-center text-xs text-muted-foreground">
            ¿No eres staff?{" "}
            <Link to="/login" className="underline">Inicio de sesión normal</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
