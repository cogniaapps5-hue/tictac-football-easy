import { useEffect, useState } from "react";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

// Tres listas (día/mes/año) con estado interno: mantiene lo elegido aunque
// falten las otras listas, y avisa al formulario solo cuando la fecha está completa.
export function SelectorFecha({
  id,
  valor,
  onChange,
  invalido,
}: {
  id: string;
  valor: string; // AAAA-MM-DD o ""
  onChange: (v: string) => void;
  invalido?: boolean;
}) {
  const partir = (v: string) => {
    const [a = "", m = "", d = ""] = v ? v.split("-") : [];
    return { a, m, d };
  };
  const [sel, setSel] = useState(() => partir(valor));

  // Si el formulario se limpia o precarga desde fuera, reflejarlo.
  useEffect(() => {
    setSel(partir(valor));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  const anioActual = new Date().getFullYear();
  const anios = Array.from({ length: 30 }, (_, i) => String(anioActual - 4 - i));
  const dias = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));

  const elegir = (campo: "a" | "m" | "d", v: string) => {
    const nueva = { ...sel, [campo]: v };
    setSel(nueva);
    if (nueva.a && nueva.m && nueva.d) onChange(`${nueva.a}-${nueva.m}-${nueva.d}`);
  };

  const clase = `h-14 rounded-xl border bg-background px-3 text-lg ${invalido ? "border-2 border-danger" : "border-input"}`;

  return (
    <div id={id} className="grid grid-cols-3 gap-2" aria-invalid={invalido}>
      <select aria-label="Día" className={clase} value={sel.d} onChange={(e) => elegir("d", e.target.value)}>
        <option value="">Día</option>
        {dias.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select aria-label="Mes" className={clase} value={sel.m} onChange={(e) => elegir("m", e.target.value)}>
        <option value="">Mes</option>
        {MESES.map((m, i) => (
          <option key={m} value={String(i + 1).padStart(2, "0")}>
            {m}
          </option>
        ))}
      </select>
      <select aria-label="Año" className={clase} value={sel.a} onChange={(e) => elegir("a", e.target.value)}>
        <option value="">Año</option>
        {anios.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </div>
  );
}
