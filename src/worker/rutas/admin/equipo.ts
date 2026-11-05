import { and, asc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { account, session, user } from "@/db/auth-schema";
import { adminsBarrio } from "@/db/schema";
import { hashPassword } from "@/shared/password";
import { borrarEnlacesRestablecer } from "../../auth";
import { avisarAccesoQuitado } from "../../avisos-solicitudes";
import { passwordTemporal } from "../../barrios";
import type { AppEnvBarrioAdmin } from "../../contexto";
import { invitarAdmin } from "../../equipo";
import { esViolacionUnica, fallar, origenDe, validar } from "../../http";
import { avisarAdmin } from "../../invitaciones";
import { paramsBarrio } from "../../params";
import { esSuperAdmin, soloPresidenta } from "../../permisos";

const paramsPersona = paramsBarrio.extend({ userId: z.string().min(1).max(100) });
const correo = z.string().trim().toLowerCase().pipe(z.email());

const esquemaInvitar = z.object({
  email: correo,
  /** Solo se usa si el correo no tiene cuenta. */
  nombre: z.string().trim().min(2).max(80),
  cargo: z.string().trim().max(80).nullish().transform((v) => v || null),
});
const esquemaCorregirCorreo = z.object({ email: correo });

const columnasPersona = {
  id: user.id,
  email: user.email,
  name: user.name,
  debeCambiarPassword: user.debeCambiarPassword,
};

/**
 * Administradores de un barrio (`/api/admin/barrios/:slug/admins`). La lista la ve cualquier admin
 * del barrio; invitar, reenviar, corregir el correo, dar otra contraseña temporal y quitar son de la
 * presidenta y el super admin (`soloPresidenta`), siempre sobre personas de ese barrio: el id de
 * alguien de otro barrio da 404.
 */
export const rutasEquipo = new Hono<AppEnvBarrioAdmin>()
  .get("/admins", async (c) => {
    const { db, barrio } = c.var;
    const admins = await db
      .select({
        id: user.id,
        email: user.email,
        nombre: user.name,
        cargo: adminsBarrio.cargo,
        rol: adminsBarrio.rol,
        debeCambiarPassword: user.debeCambiarPassword,
      })
      .from(adminsBarrio)
      .innerJoin(user, eq(user.id, adminsBarrio.userId))
      .where(eq(adminsBarrio.barrioId, barrio.id))
      // La presidenta primero, luego el equipo por nombre.
      .orderBy(sql`${adminsBarrio.rol} = 'presidenta' desc`, asc(user.name));
    return c.json({ admins: admins.map((a) => ({ ...a, debeCambiarPassword: a.debeCambiarPassword ?? false })) });
  })

  /**
   * Invitar al equipo con correo, nombre y cargo. Si el correo no tiene cuenta se crea con una
   * contraseña temporal (`passwordTemporal` solo si el correo no salió); si ya tiene, solo se le
   * asigna el barrio. Idempotente: quien ya estaba conserva su rol y cargo y no recibe otro aviso.
   */
  .post("/admins", soloPresidenta, validar("json", esquemaInvitar), async (c) => {
    const { db, barrio } = c.var;
    const { email, nombre, cargo } = c.req.valid("json");
    const r = await invitarAdmin(db, c.env, origenDe(c.req.url), barrio, { email, nombre, cargo, rol: "equipo" });
    if (!r) return fallar(c, "CORREO_EXISTENTE", 409);
    return c.json({
      admin: { id: r.userId, email, cargo: r.cargo, rol: r.rol },
      cuentaNueva: r.cuentaNueva,
      correoEnviado: r.correoEnviado,
      passwordTemporal: r.passwordTemporal,
    });
  })

  /**
   * "No le llegó": reenvía la bienvenida con un enlace nuevo de 7 días si aún no eligió su
   * contraseña, o el aviso de asignación si ya la tiene.
   */
  .post("/admins/:userId/invitacion", soloPresidenta, validar("param", paramsPersona), async (c) => {
    const { barrio } = c.var;
    const persona = await personaDelBarrio(c, c.req.valid("param").userId);
    if (!persona) return fallar(c, "NO_ENCONTRADO", 404);
    return c.json({ correoEnviado: await avisarAdmin(c.env, origenDe(c.req.url), persona, barrio) });
  })

  /**
   * Corregir el correo de quien todavía no entra (se escribió mal al invitarla): invalida los
   * enlaces mandados a la dirección equivocada y le manda la bienvenida a la nueva. Si ya eligió su
   * contraseña, la cuenta es suya y no se toca (422 `CUENTA_EN_USO`).
   */
  .patch("/admins/:userId", soloPresidenta, validar("param", paramsPersona), validar("json", esquemaCorregirCorreo), async (c) => {
    const { db, barrio } = c.var;
    const { userId } = c.req.valid("param");
    const { email } = c.req.valid("json");
    const persona = await personaDelBarrio(c, userId);
    if (!persona) return fallar(c, "NO_ENCONTRADO", 404);
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
  })

  /**
   * Otra contraseña temporal para quien todavía no entra (el correo no le llega): reemplaza la
   * anterior, cierra sus sesiones y se devuelve una sola vez para mandarla por WhatsApp.
   */
  .post("/admins/:userId/password-temporal", soloPresidenta, validar("param", paramsPersona), async (c) => {
    const { db } = c.var;
    const { userId } = c.req.valid("param");
    const persona = await personaDelBarrio(c, userId);
    if (!persona) return fallar(c, "NO_ENCONTRADO", 404);
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
  })

  /**
   * Quitar a alguien del barrio: borra su fila, cierra todas sus sesiones y, si no administra otro
   * barrio y no es super admin, borra su cuenta con sus enlaces de restablecer (las inscripciones
   * que anotó a mano se quedan: `creado_por_user_id` pasa a null). A la presidenta no se la quita:
   * primero se traspasa la presidencia (422 `ES_PRESIDENTA`). Le llega un aviso en el idioma del barrio.
   */
  .delete("/admins/:userId", soloPresidenta, validar("param", paramsPersona), async (c) => {
    const { db, barrio } = c.var;
    const { userId } = c.req.valid("param");
    const fila = await db
      .select({ ...columnasPersona, rol: adminsBarrio.rol, role: user.role })
      .from(adminsBarrio)
      .innerJoin(user, eq(user.id, adminsBarrio.userId))
      .where(and(eq(adminsBarrio.barrioId, barrio.id), eq(adminsBarrio.userId, userId)))
      .get();
    if (!fila) return fallar(c, "NO_ENCONTRADO", 404);
    if (fila.rol === "presidenta") return fallar(c, "ES_PRESIDENTA", 422);

    const otros = await db
      .select({ userId: adminsBarrio.userId })
      .from(adminsBarrio)
      .where(and(eq(adminsBarrio.userId, userId), sql`${adminsBarrio.barrioId} <> ${barrio.id}`))
      .limit(1);
    const cuentaBorrada = !esSuperAdmin({ role: fila.role }) && otros.length === 0;

    await db.batch([
      db.delete(adminsBarrio).where(and(eq(adminsBarrio.barrioId, barrio.id), eq(adminsBarrio.userId, userId))),
      db.delete(session).where(eq(session.userId, userId)),
      ...(cuentaBorrada ? [borrarEnlacesRestablecer(db, userId), db.delete(user).where(eq(user.id, userId))] : []),
    ]);
    c.executionCtx.waitUntil(avisarAccesoQuitado(c.env, barrio, { email: fila.email, nombre: fila.name }, cuentaBorrada));
    return c.json({ cuentaBorrada });
  });

/** Una persona que administra este barrio (si no, `undefined`: un id de otro barrio da 404). */
function personaDelBarrio(c: { var: AppEnvBarrioAdmin["Variables"] }, userId: string) {
  const { db, barrio } = c.var;
  return db
    .select(columnasPersona)
    .from(adminsBarrio)
    .innerJoin(user, eq(user.id, adminsBarrio.userId))
    .where(and(eq(adminsBarrio.barrioId, barrio.id), eq(adminsBarrio.userId, userId)))
    .get();
}
