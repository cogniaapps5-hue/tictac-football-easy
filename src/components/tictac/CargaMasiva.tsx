import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Tarjeta } from "@/components/tictac/Shell";
import { cargaMasiva, type EntradaCarga, type ResultadoCarga } from "@/lib/carga-masiva.functions";

type Fila = Record<string, unknown>;

function texto(fila: Fila, ...claves: string[]) {
  for (const clave of claves) {
    const encontrada = Object.keys(fila).find(
      (k) => k.trim().toLowerCase().replace(/\s+/g, "_") === clave,
    );
    if (encontrada && fila[encontrada] != null) return String(fila[encontrada]).trim();
  }
  return "";
}

function numero(fila: Fila, ...claves: string[]) {
  const valor = texto(fila, ...claves).replace(/[^\d]/g, "");
  return valor ? Number(valor) : null;
}

function leerLibro(libro: XLSX.WorkBook): EntradaCarga {
  const hoja = (nombre: string) => {
    const real = libro.SheetNames.find(
      (n) => n.trim().toLowerCase() === nombre.toLowerCase(),
    );
    if (!real) return [] as Fila[];
    return XLSX.utils.sheet_to_json<Fila>(libro.Sheets[real], { defval: "" });
  };

  const hojaAlumnos = hoja("Alumnos").length ? hoja("Alumnos") : hoja(libro.SheetNames[0] ?? "");

  return {
    apoderados: hoja("Apoderados")
      .map((f) => ({
        email: texto(f, "email", "correo"),
        nombre: texto(f, "nombre", "nombre_completo"),
        telefono: texto(f, "telefono", "teléfono", "fono"),
      }))
      .filter((f) => f.email),
    alumnos: hojaAlumnos
      .map((f) => ({
        nombre: texto(f, "nombre", "alumno"),
        rut: texto(f, "rut"),
        edad: numero(f, "edad", "anio", "año", "birth_year"),
        apoderado_email: texto(f, "apoderado_email", "email_apoderado", "apoderado"),
        dia: (texto(f, "dia", "día").toLowerCase().startsWith("j") ? "jueves" : "martes") as
          | "martes"
          | "jueves",
      }))
      .filter((f) => f.nombre),
    pagos: hoja("Pagos")
      .map((f) => ({
        alumno_rut: texto(f, "alumno_rut", "rut"),
        monto: numero(f, "monto", "amount") ?? 20000,
        concepto: texto(f, "concepto", "concept") || "Mensualidad",
      }))
      .filter((f) => f.alumno_rut),
  };
}

function plantilla() {
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    libro,
    XLSX.utils.json_to_sheet([
      { email: "apoderado@correo.cl", nombre: "María Pérez", telefono: "+56912345678" },
    ]),
    "Apoderados",
  );
  XLSX.utils.book_append_sheet(
    libro,
    XLSX.utils.json_to_sheet([
      {
        nombre: "Juan Pérez",
        rut: "12.345.678-9",
        edad: 8,
        apoderado_email: "apoderado@correo.cl",
        dia: "martes",
      },
    ]),
    "Alumnos",
  );
  XLSX.utils.book_append_sheet(
    libro,
    XLSX.utils.json_to_sheet([
      { alumno_rut: "12.345.678-9", monto: 20000, concepto: "Mensualidad" },
    ]),
    "Pagos",
  );
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
      toast.success(
        `Carga lista: ${r.alumnos} alumnos, ${r.apoderados} apoderados y ${r.pagos} pagos`,
      );
    },
    onError: () => toast.error("No pudimos completar la carga. Revisa el archivo."),
  });

  async function procesar(file: File) {
    try {
      const buffer = await file.arrayBuffer();
      const libro = XLSX.read(buffer, { type: "array" });
      const leidos = leerLibro(libro);
      if (!leidos.alumnos?.length && !leidos.apoderados?.length && !leidos.pagos?.length) {
        toast.error("El archivo no tiene datos que podamos leer");
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
      <Button variant="dorado" size="grande" onClick={() => setAbierto(true)}>
        <FileSpreadsheet /> Cargar Excel / CSV
      </Button>
    );
  }

  return (
    <Tarjeta destacada className="border-[3px]">
      <h2 className="text-2xl font-black">📄 Cargar Excel / CSV</h2>
      <p className="mt-2 text-base text-muted-foreground">
        El archivo puede tener 3 pestañas: Apoderados, Alumnos y Pagos.
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
            👨‍👩‍👦 Apoderados: <strong>{datos.apoderados?.length ?? 0}</strong> · 🧒 Alumnos:{" "}
            <strong>{datos.alumnos?.length ?? 0}</strong> · 💰 Pagos:{" "}
            <strong>{datos.pagos?.length ?? 0}</strong>
          </p>
          <div className="space-y-2 rounded-xl bg-secondary p-4">
            {(datos.alumnos ?? []).slice(0, 5).map((a, i) => (
              <p key={i} className="text-base">
                🧒 {a.nombre} — RUT {a.rut || "sin RUT"} — {a.apoderado_email || "sin apoderado"}
              </p>
            ))}
            {(datos.apoderados ?? []).slice(0, 3).map((a, i) => (
              <p key={`ap-${i}`} className="text-base">
                👤 {a.nombre || "(sin nombre)"} — {a.email}
              </p>
            ))}
            {(datos.pagos ?? []).slice(0, 3).map((p, i) => (
              <p key={`pa-${i}`} className="text-base">
                💰 RUT {p.alumno_rut} — ${p.monto} — {p.concepto}
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
            ✅ Guardado: {resultado.apoderados} apoderados, {resultado.alumnos} alumnos y{" "}
            {resultado.pagos} pagos.
          </p>
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