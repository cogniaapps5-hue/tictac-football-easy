/**
 * Preparación de comprobantes de pago antes de subirlos.
 * Los apoderados suben fotos desde el teléfono (a veces de 8 MB); las
 * reducimos a 800 px de ancho y las convertimos a WebP para que la subida
 * sea rápida incluso con señal débil. Los PDF se suben tal cual.
 */

export const MAXIMO_MB = 10;
export const TIPOS_ACEPTADOS = "image/*,.heic,.heif,application/pdf";

export type ArchivoListo = { blob: Blob; extension: string; tipo: string };

export function esPdf(file: File) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

export function esImagen(file: File) {
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i.test(file.name);
}

function soportaWebp() {
  if (typeof document === "undefined") return false;
  const canvas = document.createElement("canvas");
  return canvas.toDataURL("image/webp").startsWith("data:image/webp");
}

async function cargarImagen(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("no se pudo leer la imagen"));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * Comprime una foto a un ancho máximo de 800 px. Si el navegador no puede
 * decodificar el archivo (por ejemplo un HEIC en Android), devuelve el
 * original para no bloquear al apoderado.
 */
export async function prepararArchivo(file: File, anchoMaximo = 800): Promise<ArchivoListo> {
  if (esPdf(file)) return { blob: file, extension: "pdf", tipo: "application/pdf" };
  try {
    const img = await cargarImagen(file);
    const escala = Math.min(1, anchoMaximo / (img.naturalWidth || anchoMaximo));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round((img.naturalWidth || anchoMaximo) * escala);
    canvas.height = Math.round((img.naturalHeight || anchoMaximo) * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("sin canvas");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const usarWebp = soportaWebp();
    const tipo = usarWebp ? "image/webp" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, tipo, 0.82),
    );
    if (!blob) throw new Error("sin blob");
    return { blob, extension: usarWebp ? "webp" : "jpg", tipo };
  } catch {
    const extension = (file.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
    return { blob: file, extension, tipo: file.type || "image/jpeg" };
  }
}

/** Miniatura local para la vista previa antes de enviar. */
export function urlVistaPrevia(file: File) {
  return esImagen(file) && !/\.(heic|heif)$/i.test(file.name) ? URL.createObjectURL(file) : null;
}