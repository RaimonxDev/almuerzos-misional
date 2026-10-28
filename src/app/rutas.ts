/** Rutas del frontend en un solo lugar. */

/** Calendario del barrio; con fecha, abre en el mes de esa fecha. */
export const rutaCalendario = (slug: string, fecha?: string) => `/${slug}${fecha ? `?mes=${fecha.slice(0, 7)}` : ""}`;

export const rutaAnotarse = (slug: string, turnoId: string) => `/${slug}/anotarse/${turnoId}`;

export const rutaMiTurno = (slug: string, inscripcionId: string) => `/${slug}/mi-turno/${inscripcionId}`;
