import { Hono } from "hono";
import type { AppEnvAdmin, AppEnvBarrioAdmin } from "../../contexto";
import { conBarrioAdmin, conSesion } from "../../permisos";
import { rutasBarrio } from "./barrio";
import { rutasCuenta } from "./cuenta";
import { rutasMeses } from "./meses";
import { rutasPersonalizacion } from "./personalizacion";
import { rutasTurnos } from "./turnos";

/**
 * Todo `/api/admin`: exige sesión. Las rutas de cuenta van primero (`GET /yo`, `POST /barrios`,
 * `POST /barrios/:slug/admins`); lo que cuelga de `/barrios/:slug/*` pasa además por `conBarrioAdmin`.
 * Para agregar rutas de un barrio basta encadenarlas en meses.ts, turnos.ts o barrio.ts.
 */
const deBarrio = new Hono<AppEnvBarrioAdmin>()
  .use(conBarrioAdmin)
  .route("/", rutasMeses)
  .route("/", rutasPersonalizacion)
  .route("/", rutasTurnos)
  .route("/", rutasBarrio);

export const rutasAdmin = new Hono<AppEnvAdmin>()
  .use(conSesion)
  .route("/", rutasCuenta)
  .route("/barrios/:slug", deBarrio);
