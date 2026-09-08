import { useState } from "react";
import { CalendarCheck, Download, FileText, Loader2, Printer, X } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
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

async function cargarLogo(): Promise<string | null> {
  try {
    const res = await fetch("/tictac-logo.jpg");
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(typeof r.result === "string" ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function construirPdf(
  titulo: string,
  subtitulo: string,
  encabezados: string[],
  filas: string[][],
  pie?: string,
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const ancho = doc.internal.pageSize.getWidth();
  const logo = await cargarLogo();
  if (logo) {
    try {
      doc.addImage(logo, "JPEG", 40, 30, 48, 48);
    } catch {
      /* ignora si el formato falla */
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Escuela TIC TAC", 100, 52);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text("Siempre Feliz", 100, 68);
  doc.setDrawColor(0, 229, 255);
  doc.setLineWidth(2);
  doc.line(40, 90, ancho - 40, 90);

  doc.setTextColor(17, 17, 17);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(titulo, ancho / 2, 115, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text(subtitulo, ancho / 2, 132, { align: "center" });

  autoTable(doc, {
    startY: 150,
    head: [encabezados],
    body: filas.length ? filas : [["", "Sin datos en este período", "", "", "", ""].slice(0, encabezados.length)],
    styles: { fontSize: 10, cellPadding: 6, textColor: [17, 17, 17] },
    headStyles: { fillColor: [10, 10, 10], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [247, 249, 250] },
    margin: { left: 40, right: 40 },
  });

  if (pie) {
    const y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 150;
    doc.setDrawColor(255, 193, 7);
    doc.setLineWidth(2);
    doc.line(40, y + 16, ancho - 40, y + 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(17, 17, 17);
    doc.text(pie, 40, y + 34);
  }
  return doc;
}

async function entregarReporte(
  modo: Modo,
  titulo: string,
  subtitulo: string,
  encabezados: string[],
  filas: string[][],
  pie?: string,
) {
  const doc = await construirPdf(titulo, subtitulo, encabezados, filas, pie);
  const nombre = `${titulo.replace(/\s+/g, "-").toLowerCase()}-${iso(new Date())}.pdf`;
  if (modo === "descargar") {
    doc.save(nombre);
    toast.success("Reporte PDF descargado.");
    return;
  }
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const ventana = window.open(url, "_blank");
  if (!ventana) {
    // El navegador bloqueó la ventana: forzamos la descarga del PDF.
    doc.save(nombre);
    toast.success("Reporte PDF descargado. Ábrelo para imprimir.");
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
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