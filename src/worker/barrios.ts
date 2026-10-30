import { asc, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { z } from "zod";
import type { Db } from "@/db";
import { account, user } from "@/db/auth-schema";
import { adminsBarrio, barrios, companerismos } from "@/db/schema";
import { IDIOMAS } from "@/shared/idiomas";
import { hashPassword } from "@/shared/password";
import { avisarAdmin } from "./invitaciones";
import { esViolacionUnica, zonaValida } from "./http";

/** Enlaces que ya usa la app: un barrio con uno de ellos quedaría sin vista pública o sin panel. */
const SLUGS_RESERVADOS = ["admin", "api", "solicitar", "informacion", "nuevo-barrio", "solicitudes", "cuenta", "login", "olvide", "restablecer"];

/** Los datos de un barrio nuevo: los mismos al crearlo a mano y al aprobar una solicitud. */
export const esquemaNuevoBarrio = z.object({
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    // Reservados: chocan con rutas de la app (`/:barrio` y `/admin/:barrio`).
    .refine((s) => !SLUGS_RESERVADOS.includes(s)),
  nombre: z.string().trim().min(2).max(80),
  idioma: z.enum(IDIOMAS).optional(),
  zonaHoraria: z.string().refine(zonaValida).optional(),
  companerismos: z
    .array(z.object({ tipo: z.enum(["elderes", "hermanas"]), nombre: z.string().trim().min(1).max(60) }))
    .min(1)
    .max(10),
  /**
   * Opcional: si el correo no tiene cuenta, se crea con contraseña temporal y le llega la bienvenida
   * con un enlace para crear la suya; si ya tiene, le llega el aviso de asignación.
   */
  presidenta: z
    .object({
      email: z.string().trim().toLowerCase().pipe(z.email()),
      nombre: z.string().trim().min(2).max(80),
      cargo: z.string().trim().max(80).nullish().transform((v) => v || null),
    })
    .optional(),
});

export type DatosNuevoBarrio = z.output<typeof esquemaNuevoBarrio>;

/** Sin caracteres que se confunden al dictarla o copiarla a mano (0/O, 1/l/I). */
const ALFABETO = "abcdefghijkmnpqrstuvwxyz23456789";

/** 3 grupos de 4, ej. `k7mp-x3qa-9tdw`: ~60 bits, fácil de mandar por WhatsApp. */
export function passwordTemporal() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const letras = [...bytes].map((b) => ALFABETO[b % ALFABETO.length]).join("");
  return letras.match(/.{4}/g)!.join("-");
}

/**
 * Crea el barrio, sus compañerismos y a la presidenta en un batch, y le manda la bienvenida.
 * `extra` son sentencias que van en el mismo batch (ej. marcar la solicitud como aprobada).
 * `null` = el slug ya existe. Es lo que usan `POST /barrios` y aprobar una solicitud.
 */
export async function crearBarrio(
  db: Db,
  env: Env,
  origen: string,
  datos: DatosNuevoBarrio,
  extra: (barrioId: string) => BatchItem<"sqlite">[] = () => [],
) {
  const existente = await db.select({ id: barrios.id }).from(barrios).where(eq(barrios.slug, datos.slug)).get();
  if (existente) return null;

  const barrioId = crypto.randomUUID();
  const filasCompanerismos = datos.companerismos.map((cp, orden) => ({ barrioId, tipo: cp.tipo, nombre: cp.nombre, orden }));

  // La presidenta: si ya tiene cuenta solo se asigna; si no, se crea con una contraseña temporal.
  const p = datos.presidenta;
  const conCuenta =
    p &&
    (await db
      .select({ id: user.id, name: user.name, debeCambiarPassword: user.debeCambiarPassword })
      .from(user)
      .where(eq(user.email, p.email))
      .get());
  const nueva = p && !conCuenta ? { id: crypto.randomUUID(), password: passwordTemporal() } : null;
  const userId = conCuenta?.id ?? nueva?.id;
  const cuenta = nueva
    ? [
        // Con la contraseña temporal entra una vez: el panel la lleva a elegir la suya (`/admin/cuenta`).
        db.insert(user).values({
          id: nueva.id,
          name: p!.nombre,
          email: p!.email,
          emailVerified: true,
          role: "user",
          debeCambiarPassword: true,
        }),
        // Igual que la crea Better Auth: proveedor "credential" con el id del usuario.
        db.insert(account).values({
          id: crypto.randomUUID(),
          accountId: nueva.id,
          providerId: "credential",
          userId: nueva.id,
          password: await hashPassword(nueva.password),
          updatedAt: new Date(),
        }),
      ]
    : [];

  try {
    await db.batch([
      db.insert(barrios).values({
        id: barrioId,
        slug: datos.slug,
        nombre: datos.nombre,
        ...(datos.idioma && { idioma: datos.idioma }),
        ...(datos.zonaHoraria && { zonaHoraria: datos.zonaHoraria }),
      }),
      db.insert(companerismos).values(filasCompanerismos),
      ...cuenta,
      ...(userId ? [db.insert(adminsBarrio).values({ userId, barrioId, cargo: p!.cargo })] : []),
      ...extra(barrioId),
    ]);
  } catch (err) {
    // Carrera entre dos super admins con el mismo slug (o, muy raro, el mismo correo nuevo).
    if (esViolacionUnica(err)) return null;
    throw err;
  }

  const barrio = await db.query.barrios.findFirst({ where: eq(barrios.id, barrioId) });

  // Después del batch: si el correo falla, el barrio ya está creado. Se espera el resultado
  // (no va en segundo plano) para decirle al super admin si salió.
  const correoEnviado =
    p && userId
      ? await avisarAdmin(
          env,
          origen,
          { id: userId, email: p.email, name: conCuenta?.name ?? p.nombre, debeCambiarPassword: conCuenta ? conCuenta.debeCambiarPassword : true },
          barrio!,
        )
      : false;
  const creados = await db
    .select({ id: companerismos.id, tipo: companerismos.tipo, nombre: companerismos.nombre, activo: companerismos.activo, orden: companerismos.orden })
    .from(companerismos)
    .where(eq(companerismos.barrioId, barrioId))
    .orderBy(asc(companerismos.orden));
  return {
    barrio: {
      slug: barrio!.slug,
      nombre: barrio!.nombre,
      idioma: barrio!.idioma,
      zonaHoraria: barrio!.zonaHoraria,
      tokenMisioneros: barrio!.tokenMisioneros,
    },
    companerismos: creados,
    // La contraseña temporal se entrega solo esta vez (en la base queda su hash) y solo si el
    // correo no salió: es el respaldo de "Copiar datos". Si salió, entra con el enlace.
    presidenta: p && {
      email: p.email,
      nombre: conCuenta?.name ?? p.nombre,
      cargo: p.cargo,
      cuentaNueva: nueva !== null,
      correoEnviado,
      passwordTemporal: nueva && !correoEnviado ? nueva.password : null,
    },
    /** Para quien lo llama (aprobar una solicitud guarda el id). */
    barrioId,
  };
}
