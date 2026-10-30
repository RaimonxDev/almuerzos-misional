import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { Hono } from "hono";
import { z } from "zod";
import { adminsBarrio, barrios } from "@/db/schema";
import { account, session, user } from "@/db/auth-schema";
import { hashPassword } from "@/shared/password";
import type { AppEnvAdmin } from "../../contexto";
import { esViolacionUnica, fallar, origenDe, validar } from "../../http";
import { paramsBarrio } from "../../params";
import { esSuperAdmin } from "../../permisos";
import { borrarEnlacesRestablecer } from "../../auth";
import { avisarAdmin } from "../../invitaciones";
import { crearBarrio, esquemaNuevoBarrio, passwordTemporal } from "../../barrios";

const paramsInvitacion = paramsBarrio.extend({ userId: z.string().min(1).max(100) });

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

/** Una persona que administra ese barrio (si no, `undefined`: un id de otro barrio da 404). */
const adminDelBarrio = (db: Db, barrioId: string, userId: string) =>
  db
    .select(columnasInvitado)
    .from(adminsBarrio)
    .innerJoin(user, eq(user.id, adminsBarrio.userId))
    .where(and(eq(adminsBarrio.barrioId, barrioId), eq(adminsBarrio.userId, userId)))
    .get();

const esquemaCorregirCorreo = z.object({ email: z.string().trim().toLowerCase().pipe(z.email()) });

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
    const creado = await crearBarrio(c.var.db, c.env, origenDe(c.req.url), c.req.valid("json"));
    if (!creado) return fallar(c, "SLUG_EXISTENTE", 409);
    const { barrioId: _, ...respuesta } = creado;
    return c.json(respuesta, 201);
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
   * contraseña, o el aviso de asignación si ya la tiene. Los enlaces anteriores siguen hasta vencer
   * o hasta que elija su contraseña.
   */
  .post("/barrios/:slug/admins/:userId/invitacion", validar("param", paramsInvitacion), async (c) => {
    if (!esSuperAdmin(c.var.usuario)) return fallar(c, "SIN_PERMISO", 403);
    const { db } = c.var;
    const { slug, userId } = c.req.valid("param");
    const barrio = await barrioPorSlug(db, slug);
    const persona = barrio && (await adminDelBarrio(db, barrio.id, userId));
    if (!barrio || !persona) return fallar(c, "NO_ENCONTRADO", 404);
    return c.json({ correoEnviado: await avisarAdmin(c.env, origenDe(c.req.url), persona, barrio) });
  })

  /**
   * Corregir el correo de quien todavía no entra (se escribió mal al crearla): invalida los enlaces
   * mandados a la dirección equivocada y le manda la bienvenida a la nueva. Si ya eligió su
   * contraseña, la cuenta es suya y no se toca (422 `CUENTA_EN_USO`).
   */
  .patch(
    "/barrios/:slug/admins/:userId",
    validar("param", paramsInvitacion),
    validar("json", esquemaCorregirCorreo),
    async (c) => {
      if (!esSuperAdmin(c.var.usuario)) return fallar(c, "SIN_PERMISO", 403);
      const { db } = c.var;
      const { slug, userId } = c.req.valid("param");
      const { email } = c.req.valid("json");
      const barrio = await barrioPorSlug(db, slug);
      const persona = barrio && (await adminDelBarrio(db, barrio.id, userId));
      if (!barrio || !persona) return fallar(c, "NO_ENCONTRADO", 404);
      if (!persona.debeCambiarPassword) return fallar(c, "CUENTA_EN_USO", 422);

      try {
        await db.batch([
          db.update(user).set({ email, updatedAt: new Date() }).where(eq(user.id, userId)),
          borrarEnlacesRestablecer(db, userId),
        ]);
      } catch (err) {
        if (esViolacionUnica(err)) return fallar(c, "CORREO_EXISTENTE", 409);
        throw err;
      }
      const correoEnviado = await avisarAdmin(c.env, origenDe(c.req.url), { ...persona, email }, barrio);
      return c.json({ admin: { id: userId, email }, correoEnviado });
    },
  )

  /**
   * Otra contraseña temporal para quien todavía no entra (el correo no le llega): reemplaza la
   * anterior, cierra sus sesiones y se devuelve una sola vez para mandarla por WhatsApp.
   */
  .post("/barrios/:slug/admins/:userId/password-temporal", validar("param", paramsInvitacion), async (c) => {
    if (!esSuperAdmin(c.var.usuario)) return fallar(c, "SIN_PERMISO", 403);
    const { db } = c.var;
    const { slug, userId } = c.req.valid("param");
    const barrio = await barrioPorSlug(db, slug);
    const persona = barrio && (await adminDelBarrio(db, barrio.id, userId));
    if (!barrio || !persona) return fallar(c, "NO_ENCONTRADO", 404);
    if (!persona.debeCambiarPassword) return fallar(c, "CUENTA_EN_USO", 422);

    const password = passwordTemporal();
    await db.batch([
      db
        .update(account)
        .set({ password: await hashPassword(password), updatedAt: new Date() })
        .where(and(eq(account.userId, userId), eq(account.providerId, "credential"))),
      db.delete(session).where(eq(session.userId, userId)),
    ]);
    return c.json({ email: persona.email, passwordTemporal: password });
  });
