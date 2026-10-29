import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware, isAPIError } from "better-auth/api";
import { admin } from "better-auth/plugins";
import { waitUntil } from "cloudflare:workers";
import { asc, eq } from "drizzle-orm";
import { crearDb, type Db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { adminsBarrio, barrios } from "@/db/schema";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/shared/cuenta";
import type { Idioma } from "@/shared/idiomas";
import { hashPassword, verificarPassword } from "@/shared/password";
import { enviarCorreo } from "./correo";
import { armarCorreo } from "./correos";

/** Vencimiento del enlace de "¿Olvidaste tu contraseña?". */
export const MINUTOS_RESTABLECER = 60;

/**
 * Enlace a la pantalla de restablecer (`/admin/restablecer?token=…`) con el origen por el que
 * entró la request, así funciona igual en local, en el dominio temporal y en el definitivo.
 */
export const enlaceRestablecer = (origen: string, token: string) =>
  `${origen}/admin/restablecer?token=${encodeURIComponent(token)}`;

/** Los usuarios no tienen idioma propio: el del primer barrio que administran, o español. */
export async function idiomaDelUsuario(db: Db, userId: string): Promise<Idioma> {
  const [fila] = await db
    .select({ idioma: barrios.idioma })
    .from(adminsBarrio)
    .innerJoin(barrios, eq(barrios.id, adminsBarrio.barrioId))
    .where(eq(adminsBarrio.userId, userId))
    .orderBy(asc(adminsBarrio.creadoEn))
    .limit(1);
  return fila?.idioma ?? "es";
}

/**
 * Apaga la marca de "debe cambiar la contraseña" (la prende `POST /api/admin/barrios` al crear una
 * cuenta con contraseña temporal). Se llama cuando la persona elige su propia contraseña.
 */
export const contrasenaElegida = (db: Db, userId: string) =>
  db.update(authSchema.user).set({ debeCambiarPassword: false }).where(eq(authSchema.user.id, userId));

const crearAuth = (env: Env) => {
  const db = crearDb(env.DB);
  return betterAuth({
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, { provider: "sqlite", schema: authSchema }),
    user: {
      additionalFields: {
        // `input: false`: nadie la prende ni la apaga desde los endpoints de Better Auth (update-user…).
        debeCambiarPassword: { type: "boolean", required: false, defaultValue: false, input: false },
      },
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
      password: { hash: hashPassword, verify: verificarPassword },
      resetPasswordTokenExpiresIn: MINUTOS_RESTABLECER * 60,
      // Quien tenga la contraseña vieja (o una sesión robada) queda fuera.
      revokeSessionsOnPasswordReset: true,
      // `url` apunta a la API de Better Auth; el enlace va directo a la pantalla con el token.
      // Corre en segundo plano (`backgroundTasks`): la respuesta no espera a Resend, así tarda
      // lo mismo exista o no el correo.
      sendResetPassword: async ({ user, url, token }, request) => {
        const origen = new URL(request?.url ?? url).origin;
        const correo = armarCorreo(await idiomaDelUsuario(db, user.id), "restablecerPassword", {
          nombre: user.name,
          enlace: enlaceRestablecer(origen, token),
          minutos: MINUTOS_RESTABLECER,
        });
        await enviarCorreo(env, { para: user.email, ...correo });
      },
      // Restablecer por correo también es elegir la contraseña propia.
      onPasswordReset: async ({ user }) => {
        await contrasenaElegida(db, user.id);
      },
    },
    hooks: {
      // Solo si el cambio salió bien: un error (contraseña actual incorrecta, muy corta) es un APIError.
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/change-password") return;
        const respuesta = ctx.context.returned as { user?: { id: string } } | undefined;
        if (!respuesta || isAPIError(respuesta) || !respuesta.user) return;
        await contrasenaElegida(db, respuesta.user.id);
      }),
    },
    // En la base y no en memoria: en Workers cada isolate tendría su propio contador.
    rateLimit: {
      enabled: true,
      storage: "database",
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        // Cada pedido manda un correo: más estricto que el login.
        "/request-password-reset": { window: 60, max: 3 },
      },
    },
    advanced: {
      // Cloudflare pone la IP real del cliente en este header.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      // `waitUntil` de la request en curso: el Worker no se corta antes de terminar el envío.
      backgroundTasks: { handler: waitUntil },
    },
    plugins: [admin()],
  });
};

export type Auth = ReturnType<typeof crearAuth>;

const instancias = new WeakMap<Env, Auth>();

/**
 * Better Auth solo para administradores: no hay registro público (`disableSignUp`); el super admin
 * crea las cuentas con `/api/auth/admin/create-user` del plugin `admin`. El rol `admin` del plugin
 * es el super admin; los admins de barrio tienen rol `user` y filas en `admins_barrio`.
 * En Workers `env` solo existe dentro del handler: se arma la primera vez y se reutiliza mientras
 * el isolate reciba el mismo `env`.
 */
export function obtenerAuth(env: Env): Auth {
  let auth = instancias.get(env);
  if (!auth) {
    auth = crearAuth(env);
    instancias.set(env, auth);
  }
  return auth;
}
