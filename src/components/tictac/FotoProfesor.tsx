import { useState } from "react";

/** Fotos locales en public/profes/ como respaldo cuando la base no trae photo_url. */
const FOTOS_LOCALES: Record<string, string> = {
  "felipe guerrero": "felipe-guerrero",
  "luis felipe guerrero": "felipe-guerrero",
  "luis felipe guerrero ossa": "felipe-guerrero",
  "sebastian cerda": "sebastian-cerda",
  "sebastian antonio cerda tapia": "sebastian-cerda",
  "cristopher hormazabal": "cristopher-hormazabal",
  "cristopher alan hormazabal torres": "cristopher-hormazabal",
};

function normalizar(nombre: string) {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function iniciales(nombre: string) {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function fotoLocal(nombre: string) {
  const clave = FOTOS_LOCALES[normalizar(nombre)];
  return clave ? `/profes/${clave}.jpg` : null;
}

export function FotoProfesor({
  url,
  nombre,
  colorBorde = "border-cyan-brand",
  colorTexto = "text-cyan-brand",
  className = "",
}: {
  url?: string | null;
  nombre: string;
  colorBorde?: string;
  colorTexto?: string;
  className?: string;
}) {
  const fuente = url?.trim() || fotoLocal(nombre);
  const [error, setError] = useState(false);

  // Debug: ver en consola qué ruta intenta cargar cada profesor
  console.log(`[FotoProfesor] ${nombre} →`, fuente ?? "(sin foto, mostrando iniciales)");

  if (!fuente || error) {
    return (
      <div
        className={`flex h-[120px] w-[120px] items-center justify-center rounded-full border-4 bg-card text-4xl font-black ${colorBorde} ${colorTexto} ${className}`}
        aria-label={`Sin foto de ${nombre}`}
      >
        {iniciales(nombre)}
      </div>
    );
  }

  return (
    <img
      src={fuente}
      alt={`Foto del profesor ${nombre}`}
      loading="lazy"
      decoding="async"
      onError={() => {
        console.warn(`[FotoProfesor] No se pudo cargar: ${fuente}`);
        setError(true);
      }}
      className={`h-[120px] w-[120px] rounded-full border-4 bg-card object-cover ${colorBorde} ${className}`}
    />
  );
}
