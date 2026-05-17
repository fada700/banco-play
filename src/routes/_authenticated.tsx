import { createFileRoute, redirect, Outlet, Link, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AuthLayout,
});

function AuthLayout() {
  const loc = useLocation();
  const hideNav = ["/transferir", "/depositar", "/retirar", "/admin", "/trabajador-panel", "/credito"].some((p) =>
    loc.pathname.startsWith(p),
  );

  return (
    <div className="min-h-screen bg-background">
      <div className={hideNav ? "" : "pb-20"}>
        <Outlet />
      </div>
      {!hideNav && <BottomNav pathname={loc.pathname} />}
    </div>
  );
}

const items = [
  { to: "/home", label: "Inicio", icon: IconHome },
  { to: "/tarjetas", label: "Tarjetas", icon: IconCard },
  { to: "/historial", label: "Movimientos", icon: IconList },
  { to: "/perfil", label: "Perfil", icon: IconUser },
] as const;

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-border">
      <div className="container-app flex items-center justify-between py-2">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 bmx-tap ${
                active ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <Icon active={active} />
              <span className="text-[10px] font-medium tracking-wide">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function IconHome({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" />
    </svg>
  );
}
function IconCard({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19" />
    </svg>
  );
}
function IconList({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  );
}
function IconUser({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" /><path d="M3.5 21c1.5-4.5 5-7 8.5-7s7 2.5 8.5 7" />
    </svg>
  );
}
