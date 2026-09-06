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

// Selector con tres listas (día/mes/año): evita el calendario nativo del celular,
// que a veces no guarda el año al dar "Aceptar".
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
  const [anio = "", mes = "", dia = ""] = valor ? valor.split("-") : [];
  const anioActual = new Date().getFullYear();
  const anios = Array.from({ length: 30 }, (_, i) => String(anioActual - 4 - i));
  const dias = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));

  const emitir = (a: string, m: string, d: string) => {
    if (a && m && d) onChange(`${a}-${m}-${d}`);
    else onChange("");
  };

  const clase = `h-14 rounded-xl border bg-background px-3 text-lg ${invalido ? "border-2 border-danger" : "border-input"}`;

  return (
    <div id={id} className="grid grid-cols-3 gap-2" aria-invalid={invalido}>
      <select
        aria-label="Día"
        className={clase}
        value={dia}
        onChange={(e) => emitir(anio, mes, e.target.value)}
      >
        <option value="">Día</option>
        {dias.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        aria-label="Mes"
        className={clase}
        value={mes}
        onChange={(e) => emitir(anio, e.target.value, dia)}
      >
        <option value="">Mes</option>
        {MESES.map((m, i) => (
          <option key={m} value={String(i + 1).padStart(2, "0")}>
            {m}
          </option>
        ))}
      </select>
      <select
        aria-label="Año"
        className={clase}
        value={anio}
        onChange={(e) => emitir(e.target.value, mes, dia)}
      >
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
