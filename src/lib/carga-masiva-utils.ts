// Acepta DD-MM-AAAA (también DD/MM/AAAA) y AAAA-MM-DD.
export function parseFechaNacimiento(valor: string): string | null {
  const limpio = valor.trim();
  if (!limpio) return null;
  let anio: number, mes: number, dia: number;
  const iso = limpio.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  const cl = limpio.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (iso) [, anio, mes, dia] = iso.map(Number) as unknown as number[];
  else if (cl) {
    dia = Number(cl[1]);
    mes = Number(cl[2]);
    anio = Number(cl[3]);
  } else return null;
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || anio < 1950 || anio > 2100) return null;
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) return null;
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function edadDesde(fechaIso: string, hoy = new Date()) {
  const [a, m, d] = fechaIso.split("-").map(Number);
  let edad = hoy.getFullYear() - a;
  const cumpleAun = hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d);
  if (cumpleAun) edad -= 1;
  return edad;
}

// Iniciados 7-8 · Intermedios 9-10 · Avanzados 11-12
export function grupoPorEdad(edad: number) {
  if (edad <= 8) return "iniciados" as const;
  if (edad <= 10) return "intermedios" as const;
  return "avanzados" as const;
}
