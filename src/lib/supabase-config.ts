// Valores públicos de Supabase (URL + clave publicable). No son secretos:
// quedan expuestos en el bundle del navegador de todas formas.
// Se dejan como respaldo para entornos de despliegue donde las variables
// de entorno no están inyectadas (por ejemplo hosting propio).
export const SUPABASE_URL_PUBLICO = "https://eqcrsvyvthiwihofkgvx.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY_PUBLICO =
  "sb_publishable_Y20hhOyOg3-NF5tqTiqIoQ_amCQ7p0s";

export function urlSupabase(): string {
  return (
    (typeof process !== "undefined" ? process.env?.["SUPABASE_URL"] : undefined) ||
    SUPABASE_URL_PUBLICO
  );
}

export function clavePublicableSupabase(): string {
  return (
    (typeof process !== "undefined"
      ? process.env?.["SUPABASE_PUBLISHABLE_KEY"]
      : undefined) || SUPABASE_PUBLISHABLE_KEY_PUBLICO
  );
}
