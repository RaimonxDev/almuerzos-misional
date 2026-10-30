/**
 * Fechas como texto `YYYY-MM-DD` en la zona horaria del barrio.
 * Nunca se usa la zona del servidor ni la del dispositivo para decidir "qué día es".
 */

/** Fecha de hoy (`YYYY-MM-DD`) en una zona IANA, ej. `America/Santiago`. */
export function hoyEnZona(zonaHoraria: string, ahora = new Date()): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zonaHoraria,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

/** Todas las fechas de un mes (1–12) como `YYYY-MM-DD`. */
export function fechasDelMes(anio: number, mes: number): string[] {
  const dias = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const mm = String(mes).padStart(2, "0");
  return Array.from({ length: dias }, (_, i) => `${anio}-${mm}-${String(i + 1).padStart(2, "0")}`);
}

/** Día de la semana de una fecha `YYYY-MM-DD`: 0 = domingo … 6 = sábado. */
export function diaDeSemana(fecha: string): number {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
}

/** ¿Es una zona horaria IANA que el runtime conoce? (API y formularios) */
export const zonaValida = (zona: string) => {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: zona });
    return true;
  } catch {
    return false;
  }
};

/**
 * Zona del dispositivo, solo para sugerir la de un barrio nuevo en un formulario
 * (nunca para decidir qué día es).
 */
export const zonaDelNavegador = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Santiago";
  } catch {
    return "America/Santiago";
  }
};
