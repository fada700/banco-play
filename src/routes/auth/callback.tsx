import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { startLogin } from "@/lib/auth.functions";

export const Route = createFileRoute("/auth/callback")({
  component: CallbackPage,
});

function CallbackPage() {
  const navigate = useNavigate();
  const startLoginFn = useServerFn(startLogin);
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    if (!code) {
      setError("No se recibió el código de autorización");
      return;
    }
    const redirectUri = `${window.location.origin}/auth/callback`;
    startLoginFn({ data: { code, redirectUri } })
      .then((res) => {
        sessionStorage.setItem(
          "bmx_login",
          JSON.stringify(res),
        );
        navigate({ to: "/auth/code" });
      })
      .catch((e: Error) => setError(e.message));
  }, [navigate, startLoginFn]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="container-app text-center">
        {error ? (
          <>
            <h2 className="text-xl font-semibold">No pudimos continuar</h2>
            <p className="mt-2 text-muted-foreground text-sm">{error}</p>
            <a href="/login" className="mt-6 inline-block underline">Volver</a>
          </>
        ) : (
          <>
            <div className="text-sm uppercase tracking-[0.3em] text-muted-foreground bmx-pulse">
              Verificando…
            </div>
          </>
        )}
      </div>
    </div>
  );
}
