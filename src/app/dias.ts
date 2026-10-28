/** Lista vertical de días de un mes, compartida por las vistas pública y de misioneros. */

export type Dia<T> = { fecha: string; pasado: boolean; esHoy: boolean; turnos: T[] };

/** Agrupa turnos (ya ordenados por fecha) en días; `hoy` viene de la API, en la zona del barrio. */
export function agruparPorDia<T extends { fecha: string }>(turnos: T[], hoy: string): Dia<T>[] {
  const porFecha = new Map<string, T[]>();
  for (const turno of turnos) porFecha.set(turno.fecha, [...(porFecha.get(turno.fecha) ?? []), turno]);
  return [...porFecha].map(([fecha, turnosDelDia]) => ({
    fecha,
    pasado: fecha < hoy,
    esHoy: fecha === hoy,
    turnos: turnosDelDia,
  }));
}

/**
 * Aplica el filtro a los turnos de cada día y quita los días vacíos. Los días pasados se ocultan
 * salvo `verAnteriores`; `anteriores` cuenta los que quedan tras el filtro, para el botón.
 */
export function diasVisibles<T>(dias: Dia<T>[], filtro: (turno: T) => boolean, verAnteriores: boolean) {
  const filtrados = dias.map((d) => ({ ...d, turnos: d.turnos.filter(filtro) })).filter((d) => d.turnos.length > 0);
  return {
    visibles: filtrados.filter((d) => verAnteriores || !d.pasado),
    anteriores: filtrados.filter((d) => d.pasado).length,
  };
}
