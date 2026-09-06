import { useState } from "react";
import { CalendarCheck, Download, FileText, Loader2, Printer, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tarjeta } from "@/components/tictac/Shell";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { pesos, grupoEtiqueta, grupoCorto } from "@/lib/session";

type Periodo = "semana" | "mes" | "personalizado";

function rango(periodo: Periodo, desde: string, hasta: string) {
  const hoy = new Date();
  if (periodo === "personalizado") return { desde, hasta };
  if (periodo === "semana") {
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
    return { desde: iso(inicio), hasta: iso(hoy) };
  }
  return { desde: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: iso(hoy) };
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function escapar(texto: string) {
  return texto.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

type Modo = "ver" | "descargar";

function construirHtml(
  titulo: string,
  subtitulo: string,
  encabezados: string[],
  filas: string[][],
  pie?: string,
) {
  const logo =
    typeof window !== "undefined" ? `${window.location.origin}/tictac-logo.jpg` : "/tictac-logo.jpg";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapar(titulo)} — TIC TAC</title>
<style>
  * { box-sizing:border-box; }
  body { font-family: Arial, Helvetica, sans-serif; background:#fff; color:#111; font-size:14px; margin:20px; }
  header { display:flex; align-items:center; justify-content:center; gap:14px; border-bottom:3px solid #00E5FF; padding-bottom:12px; }
  header img { height:64px; width:64px; object-fit:cover; border-radius:8px; }
  header .marca { font-size:18px; font-weight:bold; line-height:1.2; }
  header .marca span { display:block; font-size:12px; font-weight:normal; color:#6B7280; }
  h1 { text-align:center; font-size:20px; font-weight:bold; margin:16px 0 4px; }
  .fecha { text-align:center; color:#6B7280; font-size:12px; margin-bottom:18px; }
  .envoltura { width:100%; overflow-x:auto; }
  table { width:100%; border-collapse:collapse; }
  thead { display:table-header-group; }
  th, td { border:1px solid #E5E7EB; padding:8px 10px; text-align:left; font-size:14px; vertical-align:top; }
  th { background:#0A0A0A; color:#fff; font-weight:bold; white-space:nowrap; }
  td:nth-child(n+3) { white-space:nowrap; }
  tbody tr:nth-child(even) { background:#F7F9FA; }
  tr { page-break-inside:avoid; }
  .pie { margin-top:16px; font-weight:bold; font-size:15px; border-top:2px solid #FFC107; padding-top:10px; }
  .acciones { margin-top:24px; display:flex; gap:12px; flex-wrap:wrap; }
  .acciones button { font-size:16px; padding:14px 22px; border:1px solid #111; background:#111; color:#fff; border-radius:10px; cursor:pointer; }
  .acciones button.sec { background:#fff; color:#111; }
  @media (max-width: 640px) {
    body { margin:12px; font-size:13px; }
    th, td { padding:6px 8px; font-size:12px; }
  }
  @media print {
    .acciones { display:none !important; }
    body { margin:0; }
    th { background:#E5E7EB !important; color:#000 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    @page { size: A4; margin: 12mm; }
  }
</style></head><body>
<header>
  <img src="${logo}" alt="Escuela TIC TAC" />
  <div class="marca">Escuela TIC TAC<span>Siempre Feliz</span></div>
</header>
<h1>${escapar(titulo)}</h1>
<p class="fecha">${escapar(subtitulo)}</p>
<div class="envoltura">
<table><thead><tr>${encabezados.map((h) => `<th>${escapar(h)}</th>`).join("")}</tr></thead>
<tbody>${filas
    .map((f) => `<tr>${f.map((c) => `<td>${escapar(c)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>
</div>
${pie ? `<p class="pie">${escapar(pie)}</p>` : ""}
${filas.length ? "" : '<p class="pie">No hay datos en este período.</p>'}
<div class="acciones">
  <button onclick="window.print()">Imprimir</button>
  <button class="sec" onclick="window.close()">Cerrar</button>
</div>
</body></html>`;

}

function descargarHtml(titulo: string, html: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `${titulo.replace(/\s+/g, "-").toLowerCase()}-${iso(new Date())}.html`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast.success("Reporte descargado. Ábrelo y presiona Imprimir.");
}

function entregarReporte(
  modo: Modo,
  titulo: string,
  subtitulo: string,
  encabezados: string[],
  filas: string[][],
  pie?: string,
) {
  const html = construirHtml(titulo, subtitulo, encabezados, filas, pie);
  if (modo === "descargar") {
    descargarHtml(titulo, html);
    return;
  }
  const ventana = window.open("", "_blank");
  if (!ventana) {
    // El navegador del celular bloquea las ventanas nuevas: descargamos el
    // reporte para que igual se pueda ver e imprimir.
    descargarHtml(titulo, html);
    return;
  }
  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
}


function OpcionesPeriodo({
  periodo,
  setPeriodo,
  desde,
  setDesde,
  hasta,
  setHasta,
}: {
  periodo: Periodo;
  setPeriodo: (p: Periodo) => void;
  desde: string;
  setDesde: (v: string) => void;
  hasta: string;
  setHasta: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <Label className="text-base">Período</Label>
      <div className="flex flex-wrap gap-3">
        {(
          [
            ["semana", "Esta semana"],
            ["mes", "Este mes"],
            ["personalizado", "Personalizado"],
          ] as [Periodo, string][]
        ).map(([valor, texto]) => (
          <Button
            key={valor}
            variant={periodo === valor ? "accion" : "neutro"}
            size="medio"
            onClick={() => setPeriodo(valor)}
          >
            {texto}
          </Button>
        ))}
      </div>
      {periodo === "personalizado" ? (
        <div className="flex gap-3">
          <Input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="h-14 rounded-xl text-lg"
          />
          <Input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="h-14 rounded-xl text-lg"
          />
        </div>
      ) : null}
    </div>
  );
}

export function ReportesAdmin() {
  const [abierto, setAbierto] = useState<"pagos" | "asistencia" | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [desde, setDesde] = useState(iso(new Date()));
  const [hasta, setHasta] = useState(iso(new Date()));
  const [filtroPago, setFiltroPago] = useState("todos");
  const [filtroGrupo, setFiltroGrupo] = useState("todos");
  const [cargando, setCargando] = useState(false);

  async function generarPagos(modo: Modo = "ver") {
    const r = rango(periodo, desde, hasta);
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from("payments")
        .select("amount, concept, due_date, status, players(name, profiles(full_name, email))")
        .gte("due_date", r.desde)
        .lte("due_date", r.hasta)
        .order("due_date", { ascending: false });
      if (error) throw error;
      const filtrados = (data ?? []).filter(
        (p) =>
          filtroPago === "todos" ||
          (filtroPago === "aprobados" && p.status === "approved") ||
          (filtroPago === "pendientes" && p.status === "pending") ||
          (filtroPago === "rechazados" && p.status === "rejected"),
      );
      const estados: Record<string, string> = {
        approved: "Aprobado",
        pending: "Pendiente",
        rejected: "Rechazado",
      };
      const filas = filtrados.map((p) => {
        const jugador = p.players as { name?: string; profiles?: { full_name?: string; email?: string } } | null;
        return [
          jugador?.name ?? "—",
          jugador?.profiles?.full_name || jugador?.profiles?.email || "—",
          pesos(p.amount),
          p.concept,
          new Date(`${p.due_date}T12:00:00`).toLocaleDateString("es-CL"),
          estados[p.status] ?? p.status,
        ];
      });
      const total = filtrados
        .filter((p) => p.status === "approved")
        .reduce((s, p) => s + p.amount, 0);
      entregarReporte(
        modo,
        "Reporte de Pagos",
        `Período ${new Date(`${r.desde}T12:00:00`).toLocaleDateString("es-CL")} al ${new Date(`${r.hasta}T12:00:00`).toLocaleDateString("es-CL")} · Generado el ${new Date().toLocaleDateString("es-CL")}`,
        ["Nombre Alumno", "Apoderado", "Monto", "Concepto", "Fecha", "Estado"],
        filas,
        `Total pagos aprobados: ${pesos(total)}`,
      );
      setAbierto(null);
    } catch {
      toast.error("Problema de conexión. Verifica tu internet e intenta de nuevo");
    } finally {
      setCargando(false);
    }
  }

  async function generarAsistencia(modo: Modo = "ver") {
    const r = rango(periodo, desde, hasta);
    setCargando(true);
    try {
      const [alumnos, asistencia] = await Promise.all([
        supabase.from("players").select("id, name, age_group").order("name"),
        supabase
          .from("attendance")
          .select("player_id, status, session_date")
          .gte("session_date", r.desde)
          .lte("session_date", r.hasta),
      ]);
      if (alumnos.error || asistencia.error) throw alumnos.error ?? asistencia.error;
      const lista = (alumnos.data ?? []).filter(
        (a) => filtroGrupo === "todos" || a.age_group === filtroGrupo,
      );
      const filas = lista.map((a) => {
        const suyas = (asistencia.data ?? []).filter((x) => x.player_id === a.id);
        const totales = suyas.length;
        const asistidas = suyas.filter((x) => x.status === "confirmed").length;
        return [
          a.name,
          grupoEtiqueta(a.age_group),
          String(asistidas),
          String(totales),
          totales ? `${Math.round((asistidas / totales) * 100)}%` : "—",
        ];
      });
      entregarReporte(
        modo,
        "Reporte de Asistencia",
        `Período ${new Date(`${r.desde}T12:00:00`).toLocaleDateString("es-CL")} al ${new Date(`${r.hasta}T12:00:00`).toLocaleDateString("es-CL")} · Generado el ${new Date().toLocaleDateString("es-CL")}`,
        ["Nombre Alumno", "Grupo Etario", "Clases Asistidas", "Clases Totales", "% Asistencia"],
        filas,
      );
      setAbierto(null);
    } catch {
      toast.error("Problema de conexión. Verifica tu internet e intenta de nuevo");
    } finally {
      setCargando(false);
    }
  }

  return (
    <Tarjeta>
      <div className="flex items-center gap-3">
        <Printer className="size-7 text-gold-brand" />
        <h2 className="text-xl font-bold">Reportes</h2>
      </div>
      <p className="mt-2 text-base text-muted-foreground">Genera una hoja lista para imprimir.</p>
      <Button variant="alerta" size="grande" className="mt-4" onClick={() => setAbierto("pagos")}>
        <FileText /> Reporte de Pagos
      </Button>
      <Button variant="accion" size="grande" className="mt-4" onClick={() => setAbierto("asistencia")}>
        <CalendarCheck /> Reporte de Asistencia
      </Button>

      <Dialog open={abierto === "pagos"} onOpenChange={() => setAbierto(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Reporte de Pagos</DialogTitle>
            <DialogDescription className="text-base">Elige el período y el filtro.</DialogDescription>
          </DialogHeader>
          <OpcionesPeriodo {...{ periodo, setPeriodo, desde, setDesde, hasta, setHasta }} />
          <Label className="text-base">Estado</Label>
          <div className="flex flex-wrap gap-3">
            {["todos", "aprobados", "pendientes", "rechazados"].map((f) => (
              <Button
                key={f}
                variant={filtroPago === f ? "accion" : "neutro"}
                size="medio"
                className="capitalize"
                onClick={() => setFiltroPago(f)}
              >
                {f}
              </Button>
            ))}
          </div>
          <Button variant="alerta" size="grande" disabled={cargando} onClick={() => void generarPagos("ver")}>
            {cargando ? <Loader2 className="animate-spin" /> : <Printer />} Ver e Imprimir
          </Button>
          <Button
            variant="contorno"
            size="grande"
            disabled={cargando}
            onClick={() => void generarPagos("descargar")}
          >
            <Download /> Descargar Reporte
          </Button>
          <Button variant="neutro" size="medio" className="w-full" onClick={() => setAbierto(null)}>
            <X /> Cerrar
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={abierto === "asistencia"} onOpenChange={() => setAbierto(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Reporte de Asistencia</DialogTitle>
            <DialogDescription className="text-base">Elige el período y el grupo.</DialogDescription>
          </DialogHeader>
          <OpcionesPeriodo {...{ periodo, setPeriodo, desde, setDesde, hasta, setHasta }} />
          <Label className="text-base">Grupo etario</Label>
          <div className="flex flex-wrap gap-3">
            {["todos", "iniciados", "intermedios", "avanzados"].map((f) => (
              <Button
                key={f}
                variant={filtroGrupo === f ? "accion" : "neutro"}
                size="medio"
                className="capitalize"
                onClick={() => setFiltroGrupo(f)}
              >
                {f === "todos" ? "Todos" : grupoCorto(f)}
              </Button>
            ))}
          </div>
          <Button
            variant="accion"
            size="grande"
            disabled={cargando}
            onClick={() => void generarAsistencia("ver")}
          >
            {cargando ? <Loader2 className="animate-spin" /> : <Printer />} Ver e Imprimir
          </Button>
          <Button
            variant="contorno"
            size="grande"
            disabled={cargando}
            onClick={() => void generarAsistencia("descargar")}
          >
            <Download /> Descargar Reporte
          </Button>
          <Button variant="neutro" size="medio" className="w-full" onClick={() => setAbierto(null)}>
            <X /> Cerrar
          </Button>
        </DialogContent>
      </Dialog>
    </Tarjeta>
  );
}