import { Hono } from "hono";
import type { AppEnvBarrioAdmin } from "../../contexto";

/** Datos del barrio, token de misioneros y compañerismos (issue #10). Se monta en `/api/admin/barrios/:slug`. */
export const rutasBarrio = new Hono<AppEnvBarrioAdmin>();
