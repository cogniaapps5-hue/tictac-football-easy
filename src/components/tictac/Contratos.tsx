import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";

import { Tarjeta } from "@/components/tictac/Shell";
import { supabase } from "@/integrations/supabase/client";

/** Estado de aceptación del contrato por apoderado (lee profiles.contract_accepted_at). */
export function ContratosAdmin() {
  const { data } = useQuery({
    queryKey: ["contratos-admin"],
    queryFn: async () => {
      const [perfiles, alumnos] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, contract_accepted_at").order("full_name"),
        supabase.from("players").select("id, name, parent_id, parent_email"),
      ]);
      if (perfiles.error) throw perfiles.error;
      if (alumnos.error) throw alumnos.error;
      return (perfiles.data ?? []).map((p) => ({
        ...p,
        hijos: (alumnos.data ?? [])
          .filter((a) => a.parent_id === p.id || a.parent_email === p.email)
          .map((a) => a.name),
      }));
    },
  });

  const filas = (data ?? []).filter((f) => f.hijos.length > 0);
  const aceptados = filas.filter((f) => f.contract_accepted_at).length;

  return (
    <Tarjeta>
      <div className="flex items-center gap-3">
        <FileText className="size-7 text-gold-brand" />
        <h2 className="text-xl font-bold">Contratos</h2>
      </div>
      <p className="mt-1 text-base text-muted-foreground">
        {aceptados} de {filas.length} apoderados han aceptado el contrato
      </p>

      <div className="mt-4 space-y-3">
        {filas.length === 0 ? (
          <p className="text-base text-muted-foreground">Aún no hay apoderados registrados.</p>
        ) : (
          filas.map((f) => (
            <div key={f.id} className="rounded-xl border border-border bg-secondary p-4">
              <p className="text-lg font-bold">{f.full_name || f.email}</p>
              <p className="text-base text-muted-foreground">👦 {f.hijos.join(", ")}</p>
              {f.contract_accepted_at ? (
                <p className="mt-2 text-base font-bold text-success">
                  ✅ Aceptado el{" "}
                  {new Date(f.contract_accepted_at).toLocaleDateString("es-CL", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              ) : (
                <p className="mt-2 text-base font-bold text-gold-brand">⏳ Pendiente de aceptación</p>
              )}
            </div>
          ))
        )}
      </div>
    </Tarjeta>
  );
}
