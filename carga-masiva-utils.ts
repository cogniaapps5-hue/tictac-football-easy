// RUT como clave temporal: solo números (sin puntos, guión, espacios ni dígito K).
export function rutClaveTemporal(rut: string): string {
  return rut.replace(/\D/g, "");
}

// Acepta DD-MM-AAAA (también DD/MM/AAAA), AAAA-MM-DD y M/D/YY americano (9/14/17).
export function parseFechaNacimiento(valor: string): string | null {
  const limpio = valor.trim();
  if (!limpio) return null;
  let anio: number, mes: number, dia: number;
  const iso = limpio.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  const cl = limpio.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  const corto = limpio.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$/);
  if (iso) [, anio, mes, dia] = iso.map(Number) as unknown as number[];
  else if (cl) {
    dia = Number(cl[1]);
    mes = Number(cl[2]);
    anio = Number(cl[3]);
    // Formato americano M/D/AAAA cuando el primer número no puede ser día.
    if (dia <= 12 && mes > 12) {
      const t = dia;
      dia = mes;
      mes = t;
    }
  } else if (corto) {
    // Formato americano M/D/YY (ej: 9/14/17 → 2017-09-14)
    mes = Number(corto[1]);
    dia = Number(corto[2]);
    if (mes > 12 && dia <= 12) {
      const t = mes;
      mes = dia;
      dia = t;
    }
    const yy = Number(corto[3]);
    anio = yy <= 40 ? 2000 + yy : 1900 + yy;
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

// "MARTES/ JUEVES" → ambos días. Acepta cualquier texto libre.
export function parseHorario(valor: string): { martes: boolean; jueves: boolean } {
  const t = valor
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const martes = t.includes("martes");
  const jueves = t.includes("jueves");
  if (!martes && !jueves) return { martes: true, jueves: false };
  return { martes, jueves };
}

export function textoHorario(dias: { martes: boolean; jueves: boolean }) {
  if (dias.martes && dias.jueves) return "Martes y Jueves";
  return dias.jueves ? "Jueves" : "Martes";
}

export function normalizarCondicion(valor: string) {
  const t = valor.trim();
  if (!t) return "Ninguna";
  const plano = t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (plano === "sano" || plano === "sana" || plano === "ninguna" || plano === "no") return "Ninguna";
  return t;
}
