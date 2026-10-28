import { env } from "cloudflare:test";
import { exports } from "cloudflare:workers";
import { crearDb } from "@/db";
import { barrios, companerismos, inscripciones, meses, turnos } from "@/db/schema";
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
export function pedir(ruta: string, init?: RequestInit & { json?: unknown; token?: string }) {
  const headers = new Headers(init?.headers);
  if (init?.json !== undefined) headers.set("Content-Type", "application/json");
  if (init?.token) headers.set("Authorization", `Bearer ${init.token}`);
  return exports.default.fetch(
    new Request(`http://localhost${ruta}`, {
      ...init,
      headers,
      body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    }),
  );
}
