import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Home,
  Users,
  Wallet,
  Megaphone,
  User,
  BookOpen,
  ClipboardList,
  FileText,
  LogOut,
  KeyRound,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { limpiarBorradores } from "@/lib/almacenamiento";
import { limpiarSesion } from "@/lib/sesion";
import { useAvisosNoLeidos } from "@/lib/avisos";
import { cn } from "@/lib/utils";
import type { Rol } from "@/lib/session";

type Item = { to: string; label: string; icon: LucideIcon; avisos?: boolean };

const NAV_ADMIN: Item[] = [
  { to: "/inicio", label: "Inicio", icon: Home },
  { to: "/alumnos", label: "Alumnos", icon: Users },
  { to: "/pagos", label: "Pagos", icon: Wallet },
  { to: "/avisos", label: "Avisos", icon: Megaphone },
  { to: "/cuerpo-tecnico", label: "Equipo", icon: ClipboardList },
];

const NAV_PADRE: Item[] = [
  { to: "/inicio", label: "Inicio", icon: Home },
  { to: "/mi-hijo", label: "Mi Hijo", icon: User },
  { to: "/contrato", label: "Contrato", icon: FileText },
  { to: "/info", label: "Info", icon: BookOpen, avisos: true },
  { to: "/cambiar-clave", label: "Clave", icon: KeyRound },
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
  const noLeidos = useAvisosNoLeidos();

  async function salir() {
    await queryClient.cancelQueries();
    queryClient.clear();
    limpiarBorradores();
    await limpiarSesion();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-dvh bg-background pb-40">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-4">
          <img src={logoAsset.url} alt="Escuela de fútbol TIC TAC" width={56} height={56} className="h-14 w-14 rounded-full object-cover" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold leading-tight">{titulo}</h1>
            {subtitulo ? (
              <p className="truncate text-base text-muted-foreground">{subtitulo}</p>
            ) : null}
          </div>
        </div>
        <div className="mx-auto mt-4 flex max-w-lg gap-4">
          <Button asChild variant="neutro" size="medio" className="flex-1">
            <Link to="/inicio">
              <Home /> Inicio
            </Link>
          </Button>
          <Button variant="neutro" size="medio" className="flex-1" onClick={salir}>
            <LogOut /> Salir
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-6 p-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card">
        <div className="mx-auto flex max-w-lg gap-2 px-3 py-2">
          {items.map(({ to, label, icon: Icon, avisos }) => (
            <Link
              key={to}
              to={to}
              className="flex min-h-[64px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-sm font-semibold text-muted-foreground"
              activeProps={{ className: "text-cyan-brand" }}
            >
              <span className="relative">
                <Icon className="size-6" />
                {avisos && rol === "parent" && noLeidos > 0 ? (
                  <span
                    aria-label={`${noLeidos} avisos nuevos`}
                    className="absolute -right-2.5 -top-1.5 flex min-w-[20px] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold leading-[18px] text-danger-foreground"
                  >
                    {noLeidos > 9 ? "9+" : noLeidos}
                  </span>
                ) : null}
              </span>
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
    <span className={"inline-block rounded-full px-4 py-1.5 text-base font-bold " + item.clase}>
      {item.texto}
    </span>
  );
}