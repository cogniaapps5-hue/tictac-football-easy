import { env } from "cloudflare:workers";

export function leerBindingCloudflare(nombre: string): string | undefined {
  const bindings = env as unknown as Record<string, unknown>;
  const valor = bindings[nombre];
  return typeof valor === "string" && valor.length > 0 ? valor : undefined;
}