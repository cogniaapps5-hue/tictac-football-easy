type RuntimeBindings = Record<string, unknown>;

let runtimeBindings: RuntimeBindings | null = null;

export function guardarRuntimeBindings(env: unknown): void {
  if (env && typeof env === "object") {
    runtimeBindings = env as RuntimeBindings;
  }
}

export function leerSecretoServidor(nombre: string): string | undefined {
  const binding = runtimeBindings?.[nombre];
  if (typeof binding === "string" && binding.length > 0) return binding;

  const variable = typeof process !== "undefined" ? process.env?.[nombre] : undefined;
  return typeof variable === "string" && variable.length > 0 ? variable : undefined;
}