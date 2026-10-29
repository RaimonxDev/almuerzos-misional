import { env } from "cloudflare:test";
import { exports } from "cloudflare:workers";
import { crearDb } from "@/db";
import { vi } from "vitest";
import { account, rateLimit, user, verification } from "@/db/auth-schema";
import { adminsBarrio, barrios, companerismos, inscripciones, meses, turnos } from "@/db/schema";
import { hashPassword } from "@/shared/password";
import { sha256Hex } from "@/worker/http";

/**
 * Datos fijos con fechas lejanas para no depender del día en que corren los tests:
 * 2099 = futuro (se puede anotar), 2000 = pasado.
 */
export const IDS = {
  libre: "t-libre",
  libreHermanas: "t-libre-hermanas",
  tomado: "t-tomado",
  bloqueadoConInscripcion: "t-bloqueado",
  pasado: "t-pasado",
  cerrado: "t-cerrado",
  borrador: "t-borrador",
  inactivo: "t-inactivo",
  deAdmin: "t-admin",
  otroBarrio: "t-otro-barrio",
} as const;

export const TELEFONO_PRIVADO = "+56 9 1111 2222";
export const NOTA_PRIVADA = "Calle Secreta 123";
export const TOKEN_TOMADO = "token-de-la-hna-tomado";

export async function sembrar() {
  const db = crearDb(env.DB);
  await db.delete(barrios);
  await db.delete(user); // en cascada: cuentas, sesiones y admins_barrio
  await db.delete(rateLimit); // los intentos de login de un test no cuentan para el siguiente
  await db.delete(verification); // tokens de restablecer contraseña

  await db.insert(barrios).values([
    { id: "b1", slug: "prueba", nombre: "Barrio Prueba", tokenMisioneros: "tm-1" },
    { id: "b2", slug: "otro", nombre: "Otro Barrio", tokenMisioneros: "tm-2" },
  ]);
  await db.insert(companerismos).values([
    { id: "c-e", barrioId: "b1", tipo: "elderes", nombre: "Élderes", orden: 0 },
    { id: "c-h", barrioId: "b1", tipo: "hermanas", nombre: "Hermanas", orden: 1 },
    { id: "c-x", barrioId: "b1", tipo: "elderes", nombre: "Trasladados", orden: 2, activo: false },
    { id: "c-o", barrioId: "b2", tipo: "elderes", nombre: "Élderes", orden: 0 },
  ]);
  await db.insert(meses).values([
    { id: "m-futuro", barrioId: "b1", anio: 2099, mes: 1, estado: "abierto" },
    { id: "m-pasado", barrioId: "b1", anio: 2000, mes: 1, estado: "abierto" },
    { id: "m-cerrado", barrioId: "b1", anio: 2099, mes: 3, estado: "cerrado" },
    { id: "m-borrador", barrioId: "b1", anio: 2099, mes: 2, estado: "borrador" },
    { id: "m-otro", barrioId: "b2", anio: 2099, mes: 1, estado: "abierto" },
  ]);
  await db.insert(turnos).values([
    { id: IDS.libre, mesId: "m-futuro", companerismoId: "c-e", fecha: "2099-01-10" },
    { id: IDS.libreHermanas, mesId: "m-futuro", companerismoId: "c-h", fecha: "2099-01-10" },
    { id: IDS.tomado, mesId: "m-futuro", companerismoId: "c-e", fecha: "2099-01-11" },
    { id: IDS.deAdmin, mesId: "m-futuro", companerismoId: "c-h", fecha: "2099-01-11" },
    {
      id: IDS.bloqueadoConInscripcion,
      mesId: "m-futuro",
      companerismoId: "c-e",
      fecha: "2099-01-12",
      bloqueado: true,
      motivoBloqueo: "Conferencia de estaca",
    },
    { id: IDS.inactivo, mesId: "m-futuro", companerismoId: "c-x", fecha: "2099-01-10" },
    { id: IDS.pasado, mesId: "m-pasado", companerismoId: "c-e", fecha: "2000-01-10" },
    { id: IDS.cerrado, mesId: "m-cerrado", companerismoId: "c-e", fecha: "2099-03-10" },
    { id: IDS.borrador, mesId: "m-borrador", companerismoId: "c-e", fecha: "2099-02-10" },
    { id: IDS.otroBarrio, mesId: "m-otro", companerismoId: "c-o", fecha: "2099-01-10" },
  ]);
  await db.insert(inscripciones).values([
    {
      id: "i-tomado",
      turnoId: IDS.tomado,
      nombre: "Hna. Pérez",
      telefono: TELEFONO_PRIVADO,
      consentimientoTelefono: true,
      modalidad: "en_casa",
      nota: NOTA_PRIVADA,
      origen: "publico",
      tokenEdicionHash: await sha256Hex(TOKEN_TOMADO),
    },
    {
      id: "i-bloqueado",
      turnoId: IDS.bloqueadoConInscripcion,
      nombre: "Hna. Bloqueada",
      telefono: TELEFONO_PRIVADO,
      origen: "publico",
    },
    { id: "i-admin", turnoId: IDS.deAdmin, nombre: "Familia Muñoz", origen: "admin" },
  ]);
  return db;
}

/** Llama al Worker como lo haría el navegador. */
export function pedir(ruta: string, init?: RequestInit & { json?: unknown; token?: string; cookie?: string }) {
  const headers = new Headers(init?.headers);
  if (init?.json !== undefined) headers.set("Content-Type", "application/json");
  if (init?.token) headers.set("Authorization", `Bearer ${init.token}`);
  if (init?.cookie) {
    headers.set("Cookie", init.cookie);
    // Como el navegador: Better Auth rechaza los POST con cookie que no traen Origin.
    if (!headers.has("Origin")) headers.set("Origin", "http://localhost");
  }
  return exports.default.fetch(
    new Request(`http://localhost${ruta}`, {
      ...init,
      headers,
      body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    }),
  );
}

/** Contraseña de todos los admins de prueba creados con `crearAdmin`. */
export const PASSWORD_PRUEBA = "clave-de-prueba-123";

/**
 * Crea un usuario con cuenta de email y contraseña (el mismo hash que usa Better Auth en el Worker)
 * y lo asigna a barrios por id (`b1` = prueba, `b2` = otro). `superAdmin` le da el rol `admin` del plugin.
 */
export async function crearAdmin({
  email,
  superAdmin = false,
  barrios: barrioIds = [],
}: {
  email: string;
  superAdmin?: boolean;
  barrios?: string[];
}) {
  const db = crearDb(env.DB);
  const id = crypto.randomUUID();
  await db.insert(user).values({ id, name: email.split("@")[0], email, role: superAdmin ? "admin" : "user" });
  await db.insert(account).values({
    id: crypto.randomUUID(),
    accountId: id,
    providerId: "credential",
    userId: id,
    password: await hashPassword(PASSWORD_PRUEBA),
  });
  if (barrioIds.length > 0) {
    await db.insert(adminsBarrio).values(barrioIds.map((barrioId) => ({ userId: id, barrioId })));
  }
  return { id, email, password: PASSWORD_PRUEBA };
}

/** Inicia sesión por la API real y devuelve el valor para `pedir(ruta, { cookie })`. */
export async function iniciarSesion(email: string, password = PASSWORD_PRUEBA) {
  const res = await pedir("/api/auth/sign-in/email", { method: "POST", json: { email, password } });
  if (!res.ok) throw new Error(`No se pudo iniciar sesión (${res.status}): ${await res.text()}`);
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

export interface CorreoCapturado {
  para: string;
  asunto: string;
  texto: string;
}

/**
 * Captura los correos que salen en el test. En los tests `RESEND_API_KEY` está vacía, así que
 * `enviarCorreo` los escribe en la consola (el Worker corre en el mismo isolate que el test):
 * se espía `console.log` y se leen los que empiezan con "[correo]". Devuelve una función que
 * lista los capturados hasta ese momento. `vi.restoreAllMocks()` en un `afterEach` lo deshace.
 */
export function capturarCorreos() {
  const consola = vi.spyOn(console, "log").mockImplementation(() => {});
  return (): CorreoCapturado[] =>
    consola.mock.calls
      .map(([mensaje]) => String(mensaje))
      .filter((m) => m.startsWith("[correo]"))
      .map((m) => {
        const lineas = m.split("\n");
        const valor = (prefijo: string) => lineas.find((l) => l.startsWith(prefijo))?.slice(prefijo.length) ?? "";
        return { para: valor("Para: "), asunto: valor("Asunto: "), texto: lineas.slice(lineas.indexOf("") + 1).join("\n") };
      });
}
