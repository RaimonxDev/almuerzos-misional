import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import type { Db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { hashPassword, verificarPassword } from "@/shared/password";

/**
 * Better Auth solo para administradores: no hay registro público (`disableSignUp`); el super admin
 * crea las cuentas con `/api/auth/admin/create-user` del plugin `admin`. El rol `admin` del plugin
 * es el super admin; los admins de barrio tienen rol `user` y filas en `admins_barrio`.
 * Se arma por request porque en Workers `env` y la D1 solo existen dentro del handler.
 */
export const crearAuth = (env: Env, db: Db) =>
  betterAuth({
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, { provider: "sqlite", schema: authSchema }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      password: { hash: hashPassword, verify: verificarPassword },
    },
    plugins: [admin()],
  });

export type Auth = ReturnType<typeof crearAuth>;
