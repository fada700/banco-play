import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOAuthUrl } from "@/lib/auth.functions";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/home" });
  },
  component: LoginPage,
});

function LoginPage() {
  const getUrl = useServerFn(getOAuthUrl);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleLogin = async () => {
    setBusy(true);
    setErr(null);
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
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
          <div className="text-2xl font-bold tracking-tight">Banco De México</div>
          <div className="mt-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">BMX</div>
        </div>
        <div className="space-y-4">
          <h1 className="text-3xl font-bold leading-tight">Inicia sesión</h1>
          <p className="text-muted-foreground">
            Accede con tu cuenta de Discord. Te enviaremos un código por DM para verificar tu identidad.
          </p>
          <button
            onClick={handleLogin}
            disabled={busy}
            className="bmx-tap w-full bg-primary text-primary-foreground rounded-xl py-4 font-semibold disabled:opacity-50"
          >
            {busy ? "Conectando…" : "Continuar con Discord"}
          </button>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <p className="text-xs text-muted-foreground text-center">
            Asegúrate de tener los DMs abiertos en el servidor.
          </p>
        </div>
      </div>
    </div>
  );
}
