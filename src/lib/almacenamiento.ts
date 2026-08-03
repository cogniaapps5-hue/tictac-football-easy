/**
 * Utilidades de localStorage: la app guarda borradores de formularios, pero
 * en teléfonos antiguos el espacio es escaso. Aquí centralizamos el guardado
 * seguro, el tamaño máximo y la limpieza al cerrar sesión.
 */

const PREFIJO = "tictac:";
const MAXIMO_BYTES = 500 * 1024; // 500 KB de borradores como máximo

export function guardarBorrador(clave: string, valor: unknown) {
  if (typeof window === "undefined") return;
  try {
    const texto = JSON.stringify(valor);
    if (texto.length > MAXIMO_BYTES) return;
    window.localStorage.setItem(clave, texto);
  } catch {
    limpiarBorradores();
    try {
      window.localStorage.setItem(clave, JSON.stringify(valor));
    } catch {
      /* sin espacio: el borrador simplemente no se guarda */
    }
  }
}

export function leerBorrador<T>(clave: string): T | null {
  if (typeof window === "undefined") return null;
  const guardado = window.localStorage.getItem(clave);
  if (!guardado) return null;
  try {
    return JSON.parse(guardado) as T;
  } catch {
    window.localStorage.removeItem(clave);
    return null;
  }
}

export function borrarBorrador(clave: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(clave);
}

/** Elimina todos los borradores de la app (se usa al cerrar sesión). */
export function limpiarBorradores() {
  if (typeof window === "undefined") return;
  for (const clave of Object.keys(window.localStorage)) {
    if (clave.startsWith(PREFIJO)) window.localStorage.removeItem(clave);
  }
}