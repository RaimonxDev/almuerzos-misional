import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { Hono } from "hono";
import { z } from "zod";
import { adminsBarrio, barrios, companerismos } from "@/db/schema";
import { account, user } from "@/db/auth-schema";
import { hashPassword } from "@/shared/password";
import { IDIOMAS } from "@/shared/idiomas";
import type { AppEnvAdmin } from "../../contexto";
import { esViolacionUnica, fallar, validar, zonaValida } from "../../http";
import { paramsBarrio } from "../../params";
import { esSuperAdmin } from "../../permisos";
import { avisarAdmin } from "../../invitaciones";

const esquemaNuevoBarrio = z.object({
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    // Reservados: chocan con rutas de la app.
    .refine((s) => !["admin", "api", "nuevo-barrio"].includes(s)),
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

/** Sin caracteres que se confunden al dictarla o copiarla a mano (0/O, 1/l/I). */
const ALFABETO = "abcdefghijkmnpqrstuvwxyz23456789";

/** 3 grupos de 4, ej. `k7mp-x3qa-9tdw`: ~60 bits, fácil de mandar por WhatsApp. */
function passwordTemporal() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const letras = [...bytes].map((b) => ALFABETO[b % ALFABETO.length]).join("");
  return letras.match(/.{4}/g)!.join("-");
}

const paramsInvitacion = paramsBarrio.extend({ userId: z.string().min(1).max(100) });

/** Origen por el que entró la request: los enlaces de los correos sirven en local y en cada dominio. */
const origenDe = (url: string) => new URL(url).origin;

const esquemaNuevoAdmin = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  cargo: z.string().trim().max(80).nullish().transform((v) => v || null),
});

const barrioPorSlug = (db: Db, slug: string) =>
  db
    .select({ id: barrios.id, slug: barrios.slug, nombre: barrios.nombre, idioma: barrios.idioma })
    .from(barrios)
    .where(eq(barrios.slug, slug))
    .get();

const columnasInvitado = {
  id: user.id,
  email: user.email,
  name: user.name,
  debeCambiarPassword: user.debeCambiarPassword,
};

/** Cuenta del admin y gestión de barrios/admins (solo super admin). */
export const rutasCuenta = new Hono<AppEnvAdmin>()
  .get("/yo", async (c) => {
    const { db, usuario } = c.var;
    const superAdmin = esSuperAdmin(usuario);
    const lista = superAdmin
      ? await db
          .select({ slug: barrios.slug, nombre: barrios.nombre })
          .from(barrios)
          .orderBy(asc(barrios.nombre))
          .then((filas) => filas.map((f) => ({ ...f, cargo: null as string | null })))
      : await db
          .select({ slug: barrios.slug, nombre: barrios.nombre, cargo: adminsBarrio.cargo })
          .from(adminsBarrio)
          .innerJoin(barrios, eq(barrios.id, adminsBarrio.barrioId))
          .where(eq(adminsBarrio.userId, usuario.id))
          .orderBy(asc(barrios.nombre));
    return c.json({
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.name,
        superAdmin,
        debeCambiarPassword: usuario.debeCambiarPassword,
      },
      barrios: lista,
    });
  })

  .post("/barrios", validar("json", esquemaNuevoBarrio), async (c) => {
    if (!esSuperAdmin(c.var.usuario)) return fallar(c, "SIN_PERMISO", 403);
    const { db } = c.var;
    const datos = c.req.valid("json");

    const existente = await db.select({ id: barrios.id }).from(barrios).where(eq(barrios.slug, datos.slug)).get();
    if (existente) return fallar(c, "SLUG_EXISTENTE", 409);

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
      ]);
    } catch (err) {
      // Carrera entre dos super admins con el mismo slug (o, muy raro, el mismo correo nuevo).
      if (esViolacionUnica(err)) return fallar(c, "SLUG_EXISTENTE", 409);
      throw err;
    }

    const barrio = await db.query.barrios.findFirst({ where: eq(barrios.id, barrioId) });

    // Después del batch: si el correo falla, el barrio ya está creado. Se espera el resultado
    // (no va en segundo plano) para decirle al super admin si salió.
    const correoEnviado =
      p && userId
        ? await avisarAdmin(
            c.env,
            origenDe(c.req.url),
            { id: userId, email: p.email, name: conCuenta?.name ?? p.nombre, debeCambiarPassword: conCuenta ? conCuenta.debeCambiarPassword : true },
            barrio!,
          )
        : false;
    const creados = await db
      .select({ id: companerismos.id, tipo: companerismos.tipo, nombre: companerismos.nombre, activo: companerismos.activo, orden: companerismos.orden })
      .from(companerismos)
      .where(eq(companerismos.barrioId, barrioId))
      .orderBy(asc(companerismos.orden));
    return c.json(
      {
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
      },
      201,
    );
  })

  .post("/barrios/:slug/admins", validar("param", paramsBarrio), validar("json", esquemaNuevoAdmin), async (c) => {
    if (!esSuperAdmin(c.var.usuario)) return fallar(c, "SIN_PERMISO", 403);
    const { db } = c.var;
    const { slug } = c.req.valid("param");
    const { email, cargo } = c.req.valid("json");

    const barrio = await barrioPorSlug(db, slug);
    const persona = await db.select(columnasInvitado).from(user).where(eq(user.email, email)).get();
    if (!barrio || !persona) return fallar(c, "NO_ENCONTRADO", 404);

    // Idempotente: si ya estaba asignado no se toca (ni el cargo) ni se le vuelve a avisar.
    const insertadas = await db
      .insert(adminsBarrio)
      .values({ userId: persona.id, barrioId: barrio.id, cargo })
      .onConflictDoNothing()
      .returning({ userId: adminsBarrio.userId });
    const fila = await db
      .select({ cargo: adminsBarrio.cargo })
      .from(adminsBarrio)
      .where(and(eq(adminsBarrio.userId, persona.id), eq(adminsBarrio.barrioId, barrio.id)))
      .get();
    const correoEnviado = insertadas.length > 0 && (await avisarAdmin(c.env, origenDe(c.req.url), persona, barrio));
    return c.json({ admin: { email: persona.email, cargo: fila?.cargo ?? null }, correoEnviado });
  })

  /** Admins del barrio, para reenviarles la invitación (solo super admin). */
  .get("/barrios/:slug/admins", validar("param", paramsBarrio), async (c) => {
    if (!esSuperAdmin(c.var.usuario)) return fallar(c, "SIN_PERMISO", 403);
    const { db } = c.var;
    const barrio = await barrioPorSlug(db, c.req.valid("param").slug);
    if (!barrio) return fallar(c, "NO_ENCONTRADO", 404);
    const admins = await db
      .select({
        id: user.id,
        email: user.email,
        nombre: user.name,
        cargo: adminsBarrio.cargo,
        debeCambiarPassword: user.debeCambiarPassword,
      })
      .from(adminsBarrio)
      .innerJoin(user, eq(user.id, adminsBarrio.userId))
      .where(eq(adminsBarrio.barrioId, barrio.id))
      .orderBy(asc(user.name));
    return c.json({ admins: admins.map((a) => ({ ...a, debeCambiarPassword: a.debeCambiarPassword ?? false })) });
  })

  /**
   * "No le llegó": reenvía la bienvenida con un enlace nuevo de 7 días si aún no eligió su
   * contraseña, o el aviso de asignación si ya la tiene. Los enlaces anteriores siguen hasta vencer.
   */
  .post("/barrios/:slug/admins/:userId/invitacion", validar("param", paramsInvitacion), async (c) => {
    if (!esSuperAdmin(c.var.usuario)) return fallar(c, "SIN_PERMISO", 403);
    const { db } = c.var;
    const { slug, userId } = c.req.valid("param");
    const barrio = await barrioPorSlug(db, slug);
    if (!barrio) return fallar(c, "NO_ENCONTRADO", 404);
    const persona = await db
      .select(columnasInvitado)
      .from(adminsBarrio)
      .innerJoin(user, eq(user.id, adminsBarrio.userId))
      .where(and(eq(adminsBarrio.barrioId, barrio.id), eq(adminsBarrio.userId, userId)))
      .get();
    if (!persona) return fallar(c, "NO_ENCONTRADO", 404);
    return c.json({ correoEnviado: await avisarAdmin(c.env, origenDe(c.req.url), persona, barrio) });
  });
