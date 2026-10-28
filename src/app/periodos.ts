export type Periodo = { anio: number; mes: number };

/** `2026-11` */
export const textoPeriodo = ({ anio, mes }: Periodo) => `${anio}-${String(mes).padStart(2, "0")}`;

export function leerPeriodo(texto: string | null): Periodo | null {
  const m = texto ? /^(\d{4})-(0[1-9]|1[0-2])$/.exec(texto) : null;
  return m ? { anio: Number(m[1]), mes: Number(m[2]) } : null;
}

/**
 * Mes que se muestra al entrar: el abierto que contiene hoy; si no, el próximo abierto;
 * si todos quedaron atrás, el último.
 */
export function mesInicial(abiertos: Periodo[], hoy: string): Periodo | null {
  const actual = hoy.slice(0, 7);
  return (
    abiertos.find((p) => textoPeriodo(p) === actual) ??
    abiertos.find((p) => textoPeriodo(p) > actual) ??
    abiertos.at(-1) ??
    null
  );
}
