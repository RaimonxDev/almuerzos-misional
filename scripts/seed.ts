/**
 * Datos de prueba para desarrollo local.
 *
 *   bun run db:seed:local              → mes actual y el siguiente (en hora del barrio)
 *   bun run db:seed:local -- 2026-11   → solo ese mes
 *
 * Genera un SQL en .wrangler/seed.sql y lo ejecuta contra D1 local.
 * Es idempotente: borra los barrios de prueba (en cascada) y los vuelve a crear.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { diaDeSemana, fechasDelMes, hoyEnZona } from "../src/shared/fechas.ts";
import { hashPassword } from "../src/shared/password.ts";

/** Tokens fijos para poder abrir las URLs de prueba sin consultar la base. */
const TOKEN_MISIONEROS_CENTRO = "dev-misioneros-centro";
const TOKEN_MISIONEROS_JARDIM = "dev-misioneros-jardim";
/** Token de edición de la inscripción de ejemplo (en localStorage iría este valor). */
const TOKEN_EDICION_DEMO = "dev-edicion-demo";

type Valor = string | number | boolean | null;

const sqlValor = (v: Valor) =>
  v === null ? "NULL" : typeof v === "boolean" ? (v ? "1" : "0") : typeof v === "number" ? String(v) : `'${v.replaceAll("'", "''")}'`;

const insert = (tabla: string, fila: Record<string, Valor>) =>
  `INSERT INTO ${tabla} (${Object.keys(fila).join(", ")}) VALUES (${Object.values(fila).map(sqlValor).join(", ")});`;

const sha256 = (texto: string) => createHash("sha256").update(texto).digest("hex");

function periodos(arg: string | undefined, zonaHoraria: string) {
  if (arg) {
    const m = /^(\d{4})-(\d{2})$/.exec(arg);
    if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw new Error(`Periodo inválido: ${arg} (usar YYYY-MM)`);
    return [{ anio: Number(m[1]), mes: Number(m[2]) }];
  }
  const [anio, mes] = hoyEnZona(zonaHoraria).split("-").map(Number);
  return [{ anio, mes }, mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 }];
}

type Barrio = {
  slug: string;
  nombre: string;
  idioma: "es" | "pt" | "en";
  zonaHoraria: string;
  token: string;
  contactoNombre: string;
  contactoTelefono: string;
  notaParaCocinar: string | null;
  companerismos: { tipo: "elderes" | "hermanas"; nombre: string }[];
};

const BARRIOS: Barrio[] = [
  {
    slug: "centro",
    nombre: "Barrio Centro",
    idioma: "es",
    zonaHoraria: "America/Santiago",
    token: TOKEN_MISIONEROS_CENTRO,
    contactoNombre: "Hna. Rojas",
    contactoTelefono: "+56 9 1234 5678",
    notaParaCocinar: "El élder Soto es alérgico al maní.",
    companerismos: [
      { tipo: "elderes", nombre: "Élderes" },
      { tipo: "hermanas", nombre: "Hermanas misioneras" },
    ],
  },
  {
    // Segundo barrio en portugués para probar el idioma por defecto.
    slug: "jardim",
    nombre: "Ala Jardim",
    idioma: "pt",
    zonaHoraria: "America/Sao_Paulo",
    token: TOKEN_MISIONEROS_JARDIM,
    contactoNombre: "Irmã Souza",
    contactoTelefono: "+55 11 91234 5678",
    notaParaCocinar: null,
    companerismos: [
      { tipo: "elderes", nombre: "Élderes" },
      { tipo: "hermanas", nombre: "Sisteres" },
    ],
  },
];

/** Cuentas de prueba (solo desarrollo local). El hash es el mismo PBKDF2 que usa el Worker. */
const ADMINS = [
  { id: "seed-user-super", email: "super@ejemplo.cl", nombre: "Super Admin", password: "super-dev-123", role: "admin", barrio: null, cargo: null },
  {
    id: "seed-user-presidenta",
    email: "presidenta@ejemplo.cl",
    nombre: "Hna. Rojas",
    password: "presidenta-dev-123",
    role: "user",
    barrio: "centro",
    cargo: "Presidenta de la Sociedad de Socorro",
  },
] as const;

const sql: string[] = [];
const argPeriodo = process.argv[2];

for (const a of ADMINS) {
  sql.push(`DELETE FROM session WHERE user_id = ${sqlValor(a.id)};`);
  sql.push(`DELETE FROM account WHERE user_id = ${sqlValor(a.id)};`);
  sql.push(`DELETE FROM user WHERE id = ${sqlValor(a.id)} OR email = ${sqlValor(a.email)};`);
  sql.push(insert("user", { id: a.id, name: a.nombre, email: a.email, email_verified: true, role: a.role }));
  sql.push(
    insert("account", {
      id: `${a.id}-credencial`,
      account_id: a.id,
      provider_id: "credential",
      user_id: a.id,
      password: await hashPassword(a.password),
      updated_at: Date.now(), // timestamp_ms
    }),
  );
}

for (const b of BARRIOS) {
  const barrioId = `seed-${b.slug}`;

  sql.push(`DELETE FROM barrios WHERE slug = ${sqlValor(b.slug)};`);
  sql.push(
    insert("barrios", {
      id: barrioId,
      slug: b.slug,
      nombre: b.nombre,
      idioma: b.idioma,
      zona_horaria: b.zonaHoraria,
      token_misioneros: b.token,
      nota_para_cocinar: b.notaParaCocinar,
      contacto_nombre: b.contactoNombre,
      contacto_telefono: b.contactoTelefono,
    }),
  );

  for (const a of ADMINS) {
    if (a.barrio === b.slug) sql.push(insert("admins_barrio", { user_id: a.id, barrio_id: barrioId, cargo: a.cargo }));
  }

  const companerismoIds = b.companerismos.map((c, orden) => {
    const id = `${barrioId}-${c.tipo}`;
    sql.push(insert("companerismos", { id, barrio_id: barrioId, tipo: c.tipo, nombre: c.nombre, orden }));
    return id;
  });

  const lista = periodos(argPeriodo, b.zonaHoraria);
  for (const [n, { anio, mes }] of lista.entries()) {
    const mesId = `${barrioId}-${anio}-${String(mes).padStart(2, "0")}`;
    sql.push(
      insert("meses", {
        id: mesId,
        barrio_id: barrioId,
        anio,
        mes,
        estado: "abierto",
        escritura: b.idioma === "pt" ? "Tive fome, e destes-me de comer." : "Tuve hambre, y me disteis de comer.",
        escritura_ref: b.idioma === "pt" ? "Mateus 25:35" : "Mateo 25:35",
        plantilla: "azul",
      }),
    );

    const fechas = fechasDelMes(anio, mes);
    // El tercer domingo queda bloqueado en ambos compañerismos.
    const fechaBloqueada = fechas.filter((f) => diaDeSemana(f) === 0)[2];
    const turnoId = (fecha: string, i: number) => `${mesId}-${fecha.slice(8)}-${b.companerismos[i].tipo}`;

    for (const fecha of fechas) {
      companerismoIds.forEach((companerismoId, i) => {
        const bloqueado = fecha === fechaBloqueada;
        sql.push(
          insert("turnos", {
            id: turnoId(fecha, i),
            mes_id: mesId,
            companerismo_id: companerismoId,
            fecha,
            bloqueado,
            motivo_bloqueo: bloqueado ? (b.idioma === "pt" ? "Conferência de estaca" : "Conferencia de estaca") : null,
          }),
        );
      });
    }

    // Inscripciones de ejemplo en el último mes (así quedan en el futuro y se pueden editar),
    // solo en el barrio principal: cubren los tres casos de visibilidad del teléfono.
    if (b.slug === "centro" && n === lista.length - 1) {
      const ejemplos = [
        // Con teléfono y consentimiento: los misioneros lo ven. Editable con TOKEN_EDICION_DEMO.
        { dia: 3, i: 0, nombre: "Hna. Pérez", telefono: "+56 9 8765 4321", consentimiento: true, modalidad: "en_casa", nota: "Los Aromos 123, 13:30", origen: "publico", token: TOKEN_EDICION_DEMO },
        // Con teléfono pero sin consentimiento: no se expone en ningún endpoint.
        { dia: 3, i: 1, nombre: "Hna. González", telefono: "+56 9 5555 0000", consentimiento: false, modalidad: "llevar", nota: null, origen: "publico", token: "dev-edicion-gonzalez" },
        // Anotada a mano por la presidenta.
        { dia: 10, i: 0, nombre: "Familia Muñoz", telefono: null, consentimiento: false, modalidad: "en_casa", nota: null, origen: "admin", token: null },
      ] as const;

      for (const e of ejemplos) {
        const fecha = fechas[e.dia - 1];
        if (fecha === fechaBloqueada) continue;
        sql.push(
          insert("inscripciones", {
            id: `${turnoId(fecha, e.i)}-inscripcion`,
            turno_id: turnoId(fecha, e.i),
            nombre: e.nombre,
            telefono: e.telefono,
            consentimiento_telefono: e.consentimiento,
            modalidad: e.modalidad,
            nota: e.nota,
            origen: e.origen,
            token_edicion_hash: e.token ? sha256(e.token) : null,
          }),
        );
      }
    }

    console.log(`✓ ${b.slug}: ${anio}-${String(mes).padStart(2, "0")} abierto, ${fechas.length * companerismoIds.length} turnos, bloqueado ${fechaBloqueada}`);
  }
  console.log(`  público:    /${b.slug}`);
  console.log(`  misioneros: /${b.slug}/m/${b.token}`);
}

for (const a of ADMINS) console.log(`  admin: ${a.email} / ${a.password}${a.barrio ? ` (barrio ${a.barrio})` : " (super admin)"}`);
console.log(`  token de edición de ejemplo (Hna. Pérez): ${TOKEN_EDICION_DEMO}`);

mkdirSync(".wrangler", { recursive: true });
writeFileSync(".wrangler/seed.sql", sql.join("\n") + "\n");
execFileSync("bunx", ["wrangler", "d1", "execute", "almuerzo-misional", "--local", "--file", ".wrangler/seed.sql"], {
  stdio: "inherit",
});
