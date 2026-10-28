import { Hono } from "hono";
import type { AppEnvBarrioAdmin } from "../../contexto";

/** Meses del barrio (issue #8). Se monta en `/api/admin/barrios/:slug`. */
export const rutasMeses = new Hono<AppEnvBarrioAdmin>();
