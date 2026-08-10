import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogIn, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoAsset from "@/assets/tictac-logo.jpg.asset.json";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — Escuela de Fútbol TIC TAC" },
      {
        name: "description",
        content:
          "Entra a la app de la escuela de fútbol TIC TAC para confirmar asistencia, pagar y ver avisos.",
      },
      { property: "og:title", content: "Entrar — Escuela de Fútbol TIC TAC" },
      {
        property: "og:description",
        content: "Asistencia, pagos y avisos de la escuela de fútbol TIC TAC.",
      },
    ],
  }),
  component: Entrar,
});

function Entrar() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void irADestino(data.session.user.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  async function irADestino(userId: string) {
    const { data: perfil } = await supabase
      .from("profiles")
      .select("must_change_password")
      .eq("id", userId)
      .maybeSingle();
    navigate({ to: perfil?.must_change_password ? "/cambiar-clave" : "/inicio", replace: true });
  }

  async function entrar(correo: string, clave: string) {
    if (!correo || !clave) {
      toast.error("Escribe tu correo y tu contraseña");
      return;
    }
    setCargando(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: correo.trim(),
      password: clave,
    });

    setCargando(false);
    if (error) {
      toast.error("Correo o contraseña incorrectos. Verifica tus datos e intenta nuevamente.");
      return;
    }
    toast.success("¡Bienvenido!");
    const { data: sesion } = await supabase.auth.getUser();
    if (sesion.user) await irADestino(sesion.user.id);
    else navigate({ to: "/inicio", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10">
      <img
        src={logoAsset.url}
        alt="Escuela de fútbol TIC TAC"
        width={160}
        height={160}
        className="h-40 w-40"
      />
      <h1 className="mt-4 text-center text-3xl font-extrabold">TIC TAC</h1>
      <p className="mt-1 text-center text-lg text-muted-foreground">Siempre Feliz</p>

      <form
        className="mt-8 w-full max-w-sm space-y-5 rounded-2xl border-2 border-cyan-brand bg-card p-6 shadow-card"
        onSubmit={(e) => {
          e.preventDefault();
          void entrar(email, password);
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="email" className="text-base">
            Tu correo
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="correo@ejemplo.cl"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-14 rounded-xl text-lg"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-base">
            Tu contraseña
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-14 rounded-xl text-lg"
          />
        </div>
        <Button type="submit" variant="accion" size="grande" disabled={cargando}>
          {cargando ? <Loader2 className="animate-spin" /> : <LogIn />}
          ENTRAR
        </Button>
      </form>
    </div>
  );
}
