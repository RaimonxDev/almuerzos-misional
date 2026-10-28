import { Hono } from "hono";
import type { AppEnvBarrioAdmin } from "../../contexto";

/** Bloqueos, anotar a mano, editar y borrar inscripciones (issue #9). Se monta en `/api/admin/barrios/:slug`. */
export const rutasTurnos = new Hono<AppEnvBarrioAdmin>();
