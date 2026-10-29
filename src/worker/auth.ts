import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware, isAPIError } from "better-auth/api";
import { admin } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { crearDb, type Db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/shared/cuenta";
import { hashPassword, verificarPassword } from "@/shared/password";

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
      customRules: { "/sign-in/email": { window: 60, max: 5 } },
    },
    // Cloudflare pone la IP real del cliente en este header.
    advanced: { ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] } },
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
