import { z } from "zod";

/** Parámetros de ruta compartidos por las rutas de barrio (pública y de misioneros). */
export const paramsBarrio = z.object({ slug: z.string().min(1).max(60) });
/** Periodo `YYYY-MM` (ej. `2026-11`). */
export const esquemaPeriodo = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const paramsMes = paramsBarrio.extend({ periodo: esquemaPeriodo });
export const paramsTurno = paramsBarrio.extend({ turnoId: z.string().min(1).max(100) });
