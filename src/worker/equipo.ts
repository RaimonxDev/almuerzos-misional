import { and, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { Db } from "@/db";
import { account, user } from "@/db/auth-schema";
import { adminsBarrio } from "@/db/schema";
import type { Idioma } from "@/shared/idiomas";
import { hashPassword } from "@/shared/password";
import type { RolBarrio } from "@/shared/roles";
import { passwordTemporal } from "./barrios";
import { avisarAdmin } from "./invitaciones";
import { esViolacionUnica } from "./http";

/**
 * La cuenta de alguien a quien se le da acceso a un barrio: si el correo ya tiene cuenta se usa
 * (`nueva` = null); si no, `sentencias` la crea (rol `user`, `debeCambiarPassword` y una contraseña
 * temporal que entra una vez y lleva a `/admin/cuenta`). Las sentencias van en el mismo batch que
 * la fila de `admins_barrio`.
 */
export async function prepararCuentaAdmin(db: Db, persona: { email: string; nombre: string }) {
  const existente = await db
    .select({ id: user.id, name: user.name, debeCambiarPassword: user.debeCambiarPassword })
    .from(user)
    .where(eq(user.email, persona.email))
    .get();
  if (existente) {
    return { userId: existente.id, nombre: existente.name, debeCambiarPassword: existente.debeCambiarPassword, nueva: null, sentencias: [] as BatchItem<"sqlite">[] };
  }
  const id = crypto.randomUUID();
  const password = passwordTemporal();
  const sentencias: BatchItem<"sqlite">[] = [
    db.insert(user).values({
      id,
      name: persona.nombre,
      email: persona.email,
      emailVerified: true,
      role: "user",
      debeCambiarPassword: true,
    }),
    // Igual que la crea Better Auth: proveedor "credential" con el id del usuario.
    db.insert(account).values({
      id: crypto.randomUUID(),
      accountId: id,
      providerId: "credential",
      userId: id,
      password: await hashPassword(password),
      updatedAt: new Date(),
    }),
  ];
  return { userId: id, nombre: persona.nombre, debeCambiarPassword: true as boolean | null, nueva: { password }, sentencias };
}

/**
 * Da acceso a un barrio a alguien por su correo (crea la cuenta si hace falta) y le manda el aviso
 * (`avisarAdmin`) solo si la asignación es nueva. Si ya estaba en el barrio no se toca nada (ni su
 * rol ni su cargo). `null` = carrera con otra cuenta del mismo correo. Lo usan "Invitar" al equipo y
 * traspasar la presidencia.
 */
export async function invitarAdmin(
  db: Db,
  env: Env,
  origen: string,
  barrio: { id: string; slug: string; nombre: string; idioma: Idioma },
  datos: { email: string; nombre: string; cargo: string | null; rol?: RolBarrio },
) {
  const cuenta = await prepararCuentaAdmin(db, datos);
  let filas;
  try {
    const asignar = db
      .insert(adminsBarrio)
      .values({ userId: cuenta.userId, barrioId: barrio.id, cargo: datos.cargo, rol: datos.rol ?? "equipo" })
      .onConflictDoNothing()
      .returning({ userId: adminsBarrio.userId });
    const sentencias = [...cuenta.sentencias, asignar] as unknown as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]];
    const resultados = await db.batch(sentencias);
    filas = resultados[resultados.length - 1] as { userId: string }[];
  } catch (err) {
    if (esViolacionUnica(err)) return null;
    throw err;
  }
  const esNueva = filas.length > 0;
  const fila = await db
    .select({ cargo: adminsBarrio.cargo, rol: adminsBarrio.rol })
    .from(adminsBarrio)
    .where(and(eq(adminsBarrio.userId, cuenta.userId), eq(adminsBarrio.barrioId, barrio.id)))
    .get();
  const correoEnviado =
    esNueva &&
    (await avisarAdmin(
      env,
      origen,
      { id: cuenta.userId, email: datos.email, name: cuenta.nombre, debeCambiarPassword: cuenta.debeCambiarPassword },
      barrio,
    ));
  return {
    userId: cuenta.userId,
    nombre: cuenta.nombre,
    cargo: fila?.cargo ?? null,
    rol: fila?.rol ?? "equipo",
    cuentaNueva: cuenta.nueva !== null,
    esNueva,
    correoEnviado,
    // La contraseña temporal se entrega solo esta vez y solo si el correo no salió.
    passwordTemporal: cuenta.nueva && !correoEnviado ? cuenta.nueva.password : null,
  };
}
