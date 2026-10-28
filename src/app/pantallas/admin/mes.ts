import { textoPeriodo, type Periodo } from "@/app/periodos";

type TurnoContable = { fecha: string; bloqueado: boolean; inscripcion: unknown };

/**
 * Contadores del panel. Un bloqueo manda sobre la inscripción: los turnos bloqueados no cuentan
 * como tomados ni libres (`total` son los que se pueden dar). Un día cuenta como bloqueado si
 * todos sus turnos lo están.
 */
export function contarTurnos(turnos: TurnoContable[]) {
  const disponibles = turnos.filter((t) => !t.bloqueado);
  const tomados = disponibles.filter((t) => t.inscripcion !== null).length;
  // Fecha → ¿todos sus turnos bloqueados?
  const dias = new Map<string, boolean>();
  for (const t of turnos) dias.set(t.fecha, (dias.get(t.fecha) ?? true) && t.bloqueado);
  const diasBloqueados = [...dias.values()].filter(Boolean).length;
  return { total: disponibles.length, tomados, libres: disponibles.length - tomados, diasBloqueados };
}

/** El mes que sigue al último creado, pero nunca uno ya pasado: sin meses o con meses viejos, el de hoy. */
export function periodoParaCrear(meses: Periodo[], hoy: string): Periodo {
  const actual = { anio: Number(hoy.slice(0, 4)), mes: Number(hoy.slice(5, 7)) };
  const ultimo = meses.at(-1);
  if (!ultimo) return actual;
  const siguiente = ultimo.mes === 12 ? { anio: ultimo.anio + 1, mes: 1 } : { anio: ultimo.anio, mes: ultimo.mes + 1 };
  return textoPeriodo(siguiente) < textoPeriodo(actual) ? actual : siguiente;
}

/**
 * Para ocultar días pasados: solo en el mes de hoy. Un mes anterior se muestra completo
 * (la presidenta lo abre para revisarlo), y uno futuro no tiene días pasados.
 */
export const hoyParaElMes = (periodo: Periodo, hoy: string) => (textoPeriodo(periodo) === hoy.slice(0, 7) ? hoy : "");
