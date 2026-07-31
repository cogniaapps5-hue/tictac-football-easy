import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Tarjeta } from "@/components/tictac/Shell";
import {
  cargaMasiva,
  MENSAJE_WHATSAPP,
  type EntradaCarga,
  type ResultadoCarga,
} from "@/lib/carga-masiva.functions";

type Fila = Record<string, unknown>;

const COLUMNAS = [
  "nombre_apoderado",
  "rut_apoderado",
  "email",
  "telefono",
  "nombre_alumno",
  "rut_alumno",
  "fecha_nacimiento",
  "talla_polera",
  "condiciones_medicas",
  "dia_entrenamiento",
] as const;

function normalizar(clave: string) {
  return clave
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

function bruto(fila: Fila, clave: string) {
  const encontrada = Object.keys(fila).find((k) => normalizar(k) === clave);
  return encontrada ? fila[encontrada] : null;
}

function texto(fila: Fila, clave: string) {
  const valor = bruto(fila, clave);
  return valor == null ? "" : String(valor).trim();
}

function fecha(fila: Fila, clave: string) {
  const valor = bruto(fila, clave);
  if (valor instanceof Date) {
    return `${String(valor.getDate()).padStart(2, "0")}-${String(valor.getMonth() + 1).padStart(2, "0")}-${valor.getFullYear()}`;
  }
  return valor == null ? "" : String(valor).trim();
}

function leerLibro(libro: XLSX.WorkBook): EntradaCarga {
  const nombreHoja = libro.SheetNames[0] ?? "";
  const hoja = libro.Sheets[nombreHoja];
  const filas = hoja ? XLSX.utils.sheet_to_json<Fila>(hoja, { defval: "" }) : [];

  return {
    filas: filas
      .map((f) => ({
        nombre_apoderado: texto(f, "nombre_apoderado"),
        rut_apoderado: texto(f, "rut_apoderado"),
        email: texto(f, "email").toLowerCase(),
        telefono: texto(f, "telefono"),
        nombre_alumno: texto(f, "nombre_alumno"),
        rut_alumno: texto(f, "rut_alumno"),
        fecha_nacimiento: fecha(f, "fecha_nacimiento"),
        talla_polera: texto(f, "talla_polera").toUpperCase(),
        condiciones_medicas: texto(f, "condiciones_medicas"),
        dia_entrenamiento: (texto(f, "dia_entrenamiento").toLowerCase().startsWith("j")
          ? "jueves"
          : "martes") as "martes" | "jueves",
      }))
      .filter((f) => f.nombre_alumno),
  };
}

function plantilla() {
  const libro = XLSX.utils.book_new();
  const hoja = XLSX.utils.json_to_sheet(
    [
      {
        nombre_apoderado: "María Pérez",
        rut_apoderado: "10.111.222-3",
        email: "apoderado@correo.cl",
        telefono: "+56912345678",
        nombre_alumno: "Juan Pérez",
        rut_alumno: "12.345.678-9",
        fecha_nacimiento: "15-03-2018",
        talla_polera: "M",
        condiciones_medicas: "Ninguna",
        dia_entrenamiento: "Martes",
      },
    ],
    { header: [...COLUMNAS] },
  );
  hoja["!cols"] = COLUMNAS.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(libro, hoja, "Alumnos");
  XLSX.writeFile(libro, "Plantilla-TIC-TAC.xlsx");
}

export function CargaMasiva() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [sobre, setSobre] = useState(false);
  const [archivo, setArchivo] = useState<string>("");
  const [datos, setDatos] = useState<EntradaCarga | null>(null);
  const [resultado, setResultado] = useState<ResultadoCarga | null>(null);
  const enviar = useServerFn(cargaMasiva);

  const guardar = useMutation({
    mutationFn: async () => (await enviar({ data: datos! })) as ResultadoCarga,
    onSuccess: (r) => {
      setResultado(r);
      setDatos(null);
      queryClient.invalidateQueries();
      toast.success(`Carga lista: ${r.alumnos} alumnos y ${r.apoderados} apoderados`);
    },
    onError: () => toast.error("No pudimos completar la carga. Revisa el archivo."),
  });

  async function procesar(file: File) {
    try {
      const buffer = await file.arrayBuffer();
      const libro = XLSX.read(buffer, { type: "array", cellDates: true });
      const leidos = leerLibro(libro);
      if (!leidos.filas?.length) {
        toast.error("El archivo no tiene alumnos que podamos leer");
        return;
      }
      setArchivo(file.name);
      setResultado(null);
      setDatos(leidos);
    } catch {
      toast.error("No pudimos leer el archivo. Usa la plantilla.");
    }
  }

  if (!abierto) {
    return (
      <Button variant="alerta" size="grande" onClick={() => setAbierto(true)}>
        <FileSpreadsheet /> Cargar Excel / CSV
      </Button>
    );
  }

  return (
    <Tarjeta destacada className="border-[3px]">
      <h2 className="text-2xl font-black">📄 Cargar Excel / CSV</h2>
      <p className="mt-2 text-base text-muted-foreground">
        Una sola hoja con estas 10 columnas en la fila 1: nombre_apoderado, rut_apoderado, email,
        telefono, nombre_alumno, rut_alumno, fecha_nacimiento (DD-MM-AAAA), talla_polera (S/M/L/XL),
        condiciones_medicas y dia_entrenamiento (Martes o Jueves).
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setSobre(true);
        }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSobre(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void procesar(file);
        }}
        className={`mt-4 rounded-xl border-2 border-dashed p-6 text-center ${
          sobre ? "border-cyan-brand bg-secondary" : "border-border"
        }`}
      >
        <p className="text-lg font-semibold">Arrastra aquí tu archivo</p>
        <p className="mt-1 text-base text-muted-foreground">Formatos .xlsx o .csv</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void procesar(file);
          }}
        />
        <Button
          variant="accion"
          size="grande"
          className="mt-4"
          onClick={() => inputRef.current?.click()}
        >
          <Upload /> Elegir Archivo
        </Button>
        {archivo ? <p className="mt-3 text-base font-semibold">📎 {archivo}</p> : null}
      </div>

      <Button variant="neutro" size="medio" className="mt-4 w-full" onClick={plantilla}>
        <Download /> Descargar Plantilla
      </Button>

      {datos ? (
        <div className="mt-6 space-y-4">
          <h3 className="text-xl font-bold">Previsualización</h3>
          <p className="text-base">
            🧒 Alumnos a cargar: <strong>{datos.filas?.length ?? 0}</strong>
          </p>
          <div className="space-y-2 rounded-xl bg-secondary p-4">
            {(datos.filas ?? []).slice(0, 6).map((a, i) => (
              <p key={i} className="text-base">
                🧒 {a.nombre_alumno} — nace {a.fecha_nacimiento || "sin fecha"} —{" "}
                {a.dia_entrenamiento === "jueves" ? "Jueves" : "Martes"} —{" "}
                {a.email || "sin apoderado"}
              </p>
            ))}
          </div>
          <Button
            variant="exito"
            size="grande"
            disabled={guardar.isPending}
            onClick={() => guardar.mutate()}
          >
            {guardar.isPending ? <Loader2 className="animate-spin" /> : null} Confirmar y Guardar
          </Button>
        </div>
      ) : null}

      {resultado ? (
        <div className="mt-6 space-y-3">
          <p className="rounded-xl border-2 border-green-500 bg-green-500/15 p-4 text-lg font-semibold">
            ✅ Guardado: {resultado.alumnos} alumnos y {resultado.apoderados} apoderados nuevos.
          </p>
          {resultado.apoderados > 0 ? (
            <div className="rounded-xl border-2 border-gold-brand bg-black/70 p-4">
              <p className="text-lg font-semibold text-foreground">🔑 {MENSAJE_WHATSAPP}</p>
              <Button
                variant="accion"
                size="grande"
                className="mt-4 w-full"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(MENSAJE_WHATSAPP)
                    .then(() => toast.success("Mensaje copiado para WhatsApp"))
                    .catch(() => toast.error("No pudimos copiar el mensaje"));
                }}
              >
                <Copy /> Copiar mensaje para WhatsApp
              </Button>
            </div>
          ) : null}
          {resultado.errores.length ? (
            <div className="rounded-xl border-2 border-red-500 bg-red-500/15 p-4">
              <p className="text-lg font-bold">⚠️ Filas con problemas ({resultado.errores.length})</p>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                {resultado.errores.map((e, i) => (
                  <li key={i} className="text-base">
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <Button
        variant="neutro"
        size="medio"
        className="mt-6 w-full"
        onClick={() => {
          setAbierto(false);
          setDatos(null);
          setResultado(null);
          setArchivo("");
        }}
      >
        <X /> Cerrar
      </Button>
    </Tarjeta>
  );
}
