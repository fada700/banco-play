import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/home" });
  },
  component: LoginPage,
});

function LoginPage() {
  const handleLogin = () => {
    const clientId = (import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined) ?? "";
    // El client_id se inyecta vía discord-config publica si el usuario lo expone.
    // Si no, usamos un endpoint server para construir la URL.
    const redirectUri = `${window.location.origin}/auth/callback`;
    const params = new URLSearchParams({
      client_id: clientId || "PLACEHOLDER",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "identify",
      prompt: "consent",
    });
    window.location.href = `https://discord.com/api/oauth2/authorize?${params}`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="container-app flex-1 flex flex-col justify-between py-12">
        <div className="pt-16">
          <div className="text-2xl font-bold tracking-tight">Banco De México</div>
          <div className="mt-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">BMX</div>
        </div>
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold leading-tight">Inicia sesión</h1>
            <p className="mt-2 text-muted-foreground">
              Accede con tu cuenta de Discord. Te enviaremos un código por DM para verificar tu identidad.
            </p>
          </div>
          <button
            onClick={handleLogin}
            className="bmx-tap w-full bg-primary text-primary-foreground rounded-xl py-4 font-semibold"
          >
            Continuar con Discord
          </button>
          <p className="text-xs text-muted-foreground text-center">
            Asegúrate de tener los DMs abiertos en el servidor.
          </p>
        </div>
      </div>
    </div>
  );
}
