import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Home,
  Users,
  Wallet,
  Megaphone,
  User,
  BookOpen,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import logoAsset from "@/assets/tictac-logo.jpg.asset.json";
import type { Rol } from "@/lib/session";

type Item = { to: string; label: string; icon: LucideIcon };

const NAV_ADMIN: Item[] = [
  { to: "/inicio", label: "Inicio", icon: Home },
  { to: "/alumnos", label: "Alumnos", icon: Users },
  { to: "/pagos", label: "Pagos", icon: Wallet },
  { to: "/avisos", label: "Avisos", icon: Megaphone },
];

const NAV_PADRE: Item[] = [
  { to: "/inicio", label: "Inicio", icon: Home },
  { to: "/mi-hijo", label: "Mi Hijo", icon: User },
  { to: "/info", label: "Info", icon: BookOpen },
];

export function Shell({
  rol,
  titulo,
  subtitulo,
  children,
}: {
  rol: Rol;
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
}) {
  const items = rol === "admin" ? NAV_ADMIN : NAV_PADRE;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function salir() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <img src={logoAsset.url} alt="Escuela de fútbol TIC TAC" width={56} height={56} className="h-14 w-14" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold leading-tight">{titulo}</h1>
            {subtitulo ? (
              <p className="truncate text-sm text-muted-foreground">{subtitulo}</p>
            ) : null}
          </div>
          <Button variant="ghost" size="icon" onClick={salir} aria-label="Cerrar sesión">
            <LogOut className="text-muted-foreground" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card">
        <div className="mx-auto flex max-w-lg">
          {items.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex flex-1 flex-col items-center gap-1 py-3 text-xs font-semibold text-muted-foreground"
              activeProps={{ className: "text-cyan-brand" }}
            >
              <Icon className="size-6" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function Tarjeta({
  children,
  destacada,
  className,
}: {
  children: ReactNode;
  destacada?: boolean;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl bg-card p-5 shadow-card",
        destacada ? "border-2 border-cyan-brand" : "border border-border",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Estado({ estado }: { estado: string }) {
  const mapa: Record<string, { texto: string; clase: string }> = {
    pending: { texto: "Pendiente", clase: "bg-gold-brand text-gold-brand-foreground" },
    approved: { texto: "Aprobado", clase: "bg-success text-success-foreground" },
    rejected: { texto: "Rechazado", clase: "bg-danger text-danger-foreground" },
    confirmed: { texto: "Confirmado", clase: "bg-success text-success-foreground" },
    absent: { texto: "No viene", clase: "bg-danger text-danger-foreground" },
    no_response: { texto: "Sin respuesta", clase: "bg-secondary text-muted-foreground" },
  };
  const item = mapa[estado] ?? mapa.no_response;
  return (
    <span className={"inline-block rounded-full px-3 py-1 text-sm font-bold " + item.clase}>
      {item.texto}
    </span>
  );
}