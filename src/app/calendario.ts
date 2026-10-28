import { diaDeSemana, fechasDelMes } from "@/shared/fechas";

/**
 * Grilla de un mes para el calendario imprimible. La semana empieza en domingo.
 * `celdas` tiene `filas * 7` elementos: la fecha `YYYY-MM-DD` o `null` de relleno.
 * Mínimo 5 filas (un mes que cabe en 4 igual se dibuja con 5).
 */
export function grillaDelMes(periodo: string): { filas: number; celdas: (string | null)[] } {
  const [anio, mes] = periodo.split("-").map(Number);
  const fechas = fechasDelMes(anio, mes);
  const inicio = diaDeSemana(fechas[0]);
  const filas = Math.max(5, Math.ceil((inicio + fechas.length) / 7));
  const celdas: (string | null)[] = [...Array<null>(inicio).fill(null), ...fechas];
  while (celdas.length < filas * 7) celdas.push(null);
  return { filas, celdas };
}
