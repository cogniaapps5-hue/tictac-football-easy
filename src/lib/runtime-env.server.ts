let runtimeBindings: Record<string, unknown> = {};

export function guardarRuntimeBindings(bindings: Record<string, unknown> | undefined): void {
  runtimeBindings = bindings ?? {};
}

export function leerSecretoServidor(nombre: string): string | undefined {
  const binding = runtimeBindings[nombre];
  if (typeof binding === "string" && binding.length > 0) return binding;
  const processValue = process.env[nombre];
  return typeof processValue === "string" && processValue.length > 0 ? processValue : undefined;
}
