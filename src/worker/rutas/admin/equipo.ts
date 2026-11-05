import { and, asc, eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { Hono } from "hono";
import { z } from "zod";
import { account, session, user } from "@/db/auth-schema";
import { adminsBarrio } from "@/db/schema";
import { hashPassword } from "@/shared/password";
import { borrarEnlacesRestablecer, borrarEnlacesSiNoExiste } from "../../auth";
import { avisarAccesoQuitado, avisarPresidenciaTraspasada } from "../../avisos-solicitudes";
import { passwordTemporal } from "../../barrios";
import type { AppEnvBarrioAdmin } from "../../contexto";
import { invitarAdmin, traspasarPresidencia } from "../../equipo";
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
  role: user.role,
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
    if (!(await puedeTocarCuenta(c, persona))) return fallar(c, "SIN_PERMISO", 403);

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
    if (!(await puedeTocarCuenta(c, persona))) return fallar(c, "SIN_PERMISO", 403);

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
   * Traspasar la presidencia (la presidenta o el super admin, aunque la anterior no responda o el
   * barrio no tenga). La nueva queda `presidenta` y la anterior `equipo`, en un solo batch. Crea la
   * cuenta si el correo no la tiene (`passwordTemporal` solo si el correo no salió); a quien ya
   * es la presidenta, 422 `YA_ES_PRESIDENTA`. Avisa a ambas en el idioma del barrio.
   */
  .post("/presidencia", soloPresidenta, validar("json", esquemaInvitar), async (c) => {
    const { db, barrio } = c.var;
    const r = await traspasarPresidencia(db, c.env, origenDe(c.req.url), barrio, c.req.valid("json"));
    if (r === "YA_ES_PRESIDENTA") return fallar(c, "YA_ES_PRESIDENTA", 422);
    if (!r) return fallar(c, "CORREO_EXISTENTE", 409);
    if (r.anterior) c.executionCtx.waitUntil(avisarPresidenciaTraspasada(c.env, barrio, r.anterior, r.nueva.nombre));
    return c.json({
      presidenta: { id: r.nueva.id, email: r.nueva.email, nombre: r.nueva.nombre, cargo: r.nueva.cargo, rol: "presidenta" as const },
      anterior: r.anterior && { id: r.anterior.id, email: r.anterior.email, nombre: r.anterior.nombre },
      cuentaNueva: r.cuentaNueva,
      correoEnviado: r.correoEnviado,
      passwordTemporal: r.passwordTemporal,
    });
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
      .select({ ...columnasPersona, rol: adminsBarrio.rol })
      .from(adminsBarrio)
      .innerJoin(user, eq(user.id, adminsBarrio.userId))
      .where(and(eq(adminsBarrio.barrioId, barrio.id), eq(adminsBarrio.userId, userId)))
      .get();
    if (!fila) return fallar(c, "NO_ENCONTRADO", 404);
    if (fila.rol === "presidenta") return fallar(c, "ES_PRESIDENTA", 422);
    // A un super admin solo lo quita otro super admin, y nunca se le cierran las sesiones ni se borra su cuenta.
    const quitaSuperAdmin = esSuperAdmin({ role: fila.role });
    if (quitaSuperAdmin && !esSuperAdmin(c.var.usuario)) return fallar(c, "SIN_PERMISO", 403);

    // La cuenta se borra solo si, al momento de borrar, no administra otro barrio: la condición va en
    // el mismo DELETE para que una asignación hecha entre medio no se pierda en la cascada.
    const resultados = await db.batch([
      db.delete(adminsBarrio).where(and(eq(adminsBarrio.barrioId, barrio.id), eq(adminsBarrio.userId, userId))),
      ...(quitaSuperAdmin
        ? []
        : [
            db.delete(session).where(eq(session.userId, userId)),
            db
              .delete(user)
              .where(
                and(
                  eq(user.id, userId),
                  sql`not exists (select 1 from ${adminsBarrio} where ${adminsBarrio.userId} = ${userId})`,
                ),
              )
              .returning({ id: user.id }),
            borrarEnlacesSiNoExiste(db, userId),
          ]),
    ] as unknown as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
    const cuentaBorrada = !quitaSuperAdmin && (resultados[2] as { id: string }[]).length > 0;
    c.executionCtx.waitUntil(avisarAccesoQuitado(c.env, barrio, { email: fila.email, nombre: fila.name }, cuentaBorrada));
    return c.json({ cuentaBorrada });
  });

/**
 * La presidenta solo cambia el correo o la contraseña de cuentas que son únicamente de su barrio:
 * si la persona administra otro barrio o es super admin, eso le toca al super admin (si no, una
 * presidenta podría invitar a alguien de otro barrio que aún no entra y quedarse con su cuenta).
 */
async function puedeTocarCuenta(c: { var: AppEnvBarrioAdmin["Variables"] }, persona: { id: string; role: string | null }) {
  const { db, barrio, usuario } = c.var;
  if (esSuperAdmin(usuario)) return true;
  if (esSuperAdmin({ role: persona.role })) return false;
  const otro = await db
    .select({ userId: adminsBarrio.userId })
    .from(adminsBarrio)
    .where(and(eq(adminsBarrio.userId, persona.id), sql`${adminsBarrio.barrioId} <> ${barrio.id}`))
    .get();
  return !otro;
}

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
