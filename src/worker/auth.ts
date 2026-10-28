import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { crearDb } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { hashPassword, verificarPassword } from "@/shared/password";

const crearAuth = (env: Env) =>
  betterAuth({
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(crearDb(env.DB), { provider: "sqlite", schema: authSchema }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      password: { hash: hashPassword, verify: verificarPassword },
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
