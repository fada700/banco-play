import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { verifyCode } from "@/lib/auth.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/code")({
  component: CodePage,
});

interface LoginSession {
  sessionId: string;
  discordId: string;
  username: string;
  avatarUrl: string | null;
}

function CodePage() {
  const navigate = useNavigate();
  const verify = useServerFn(verifyCode);
  const [session, setSession] = useState<LoginSession | null>(null);
  const [digits, setDigits] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("bmx_login");
    if (!raw) {
      navigate({ to: "/login" });
      return;
    }
    setSession(JSON.parse(raw) as LoginSession);
  }, [navigate]);

  useEffect(() => {
    if (digits.length === 4 && session && !busy) {
      void submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  const submit = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const res = await verify({
        data: { sessionId: session.sessionId, discordId: session.discordId, codigo: digits },
      });
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: res.email,
        password: res.password,
      });
      if (signErr) throw signErr;
      sessionStorage.removeItem("bmx_login");
      const dest = sessionStorage.getItem("bmx_post_login_redirect");
      sessionStorage.removeItem("bmx_post_login_redirect");
      if (dest === "/admin" || dest === "/trabajador-panel") {
        window.location.replace(dest);
      } else {
        navigate({ to: "/home" });
      }
    } catch (e) {
      setError((e as Error).message);
      setDigits("");
    } finally {
      setBusy(false);
    }
  };

  const press = (n: string) => {
    if (busy) return;
    if (n === "<") return setDigits((d) => d.slice(0, -1));
    if (digits.length >= 4) return;
    setDigits((d) => d + n);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="container-app flex-1 flex flex-col py-12">
        <div className="text-center">
          {session?.avatarUrl && (
            <img
              src={session.avatarUrl}
              alt=""
              className="mx-auto h-16 w-16 rounded-full border border-border"
            />
          )}
          <h1 className="mt-4 text-2xl font-bold">Hola, {session?.username}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ingresa el código de 4 dígitos que te enviamos por DM.
          </p>
        </div>

        <div className="mt-10 flex justify-center gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-14 w-12 rounded-xl border flex items-center justify-center text-2xl font-mono ${
                digits[i] ? "border-foreground bg-surface" : "border-border"
              }`}
            >
              {digits[i] ? "●" : ""}
            </div>
          ))}
        </div>

        {error && (
          <p className="mt-4 text-center text-sm text-destructive">{error}</p>
        )}
        {busy && (
          <p className="mt-4 text-center text-sm text-muted-foreground bmx-pulse">Verificando…</p>
        )}

        <div className="mt-auto grid grid-cols-3 gap-3 pt-10">
          {["1","2","3","4","5","6","7","8","9","","0","<"].map((n, i) => (
            <button
              key={i}
              disabled={!n}
              onClick={() => n && press(n)}
              className={`h-16 rounded-2xl text-xl font-medium bmx-tap ${
                n === ""
                  ? "invisible"
                  : "bg-surface hover:bg-secondary border border-border"
              }`}
            >
              {n === "<" ? "←" : n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
