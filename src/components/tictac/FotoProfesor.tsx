import { useState } from "react";

/** Fotos locales en public/profes/ como respaldo cuando la base no trae photo_url. */
const FOTOS_LOCALES: Record<string, string> = {
  "felipe guerrero": "/profes/felipe-guerrero.jpg",
  "luis felipe guerrero": "/profes/felipe-guerrero.jpg",
  "luis felipe guerrero ossa": "/profes/felipe-guerrero.jpg",
  "sebastian cerda": "/profes/sebastian-cerda.jpg",
  "cristopher hormazabal": "/profes/cristopher-hormazabal.jpg",
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
  return FOTOS_LOCALES[normalizar(nombre)] ?? null;
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

  if (!fuente || error) {
    return (
      <div
        className={`flex size-[200px] max-w-full items-center justify-center rounded-full border-4 bg-card text-6xl font-black ${colorBorde} ${colorTexto} ${className}`}
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
      onError={() => setError(true)}
      className={`h-[280px] w-full rounded-2xl border-2 bg-card object-contain ${colorBorde} ${className}`}
    />
  );
}
