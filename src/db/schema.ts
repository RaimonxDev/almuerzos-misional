/**
 * Almuerzo Misional — esquema de base de datos (Cloudflare D1 / SQLite + Drizzle)
 *
 * Reglas del modelo:
 *  - Un TURNO es un almuerzo concreto: fecha + compañerismo (élderes u hermanas).
 *  - "Tomado" NO se guarda en el turno: un turno está tomado si tiene una inscripción.
 *    Así nunca quedan estados desincronizados.
 *  - La restricción UNIQUE sobre inscripciones.turno_id evita que dos personas
 *    tomen el mismo turno al mismo tiempo (la segunda inserción falla).
 *  - Cancelar = borrar la inscripción; el turno vuelve a quedar libre.
 *  - Las tablas de Better Auth (user, session, account, verification) viven en
 *    auth-schema.ts, generadas con su CLI. Aquí solo se referencian.
 */
import { relations, sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import { nuevoCodigo } from "../shared/codigo-misioneros";
import { IDIOMAS } from "../shared/idiomas";
import { MODALIDADES } from "../shared/inscripciones";
import { ESTADOS_SOLICITUD } from "../shared/solicitudes";
import { user } from "./auth-schema";

// ---------- helpers ----------

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const creadoEn = () =>
  integer("creado_en", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

const actualizadoEn = () =>
  integer("actualizado_en", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdateFn(() => new Date());

// ---------- barrios ----------

export const barrios = sqliteTable("barrios", {
  id: id(),
  /** Parte de la URL: /centro, /oriente */
  slug: text("slug").notNull().unique(),
  nombre: text("nombre").notNull(),
  /** Idioma por defecto de la UI para este barrio; cada persona puede cambiarlo. */
  idioma: text("idioma", { enum: IDIOMAS }).notNull().default("es"),
  /** Zona IANA con la que se calcula "hoy" y se interpretan las fechas de los turnos. */
  zonaHoraria: text("zona_horaria").notNull().default("America/Santiago"),
  /**
   * Obsoleta: el enlace con token de antes del código de misioneros. Nada la lee; sigue en el
   * esquema hasta que la versión que no la usa esté en producción, porque borrarla en la misma
   * migración rompería al Worker anterior entre `db:migrate:remote` y `deploy`. Se borra en la
   * siguiente migración.
   */
  tokenMisioneros: text("token_misioneros")
    .notNull()
    .unique()
    .$defaultFn(() => crypto.randomUUID()),
  /**
   * Código de acceso de los misioneros (`src/shared/codigo-misioneros.ts`). En claro porque la
   * presidenta necesita volver a verlo; "Cambiar código" lo reemplaza.
   */
  codigoMisioneros: text("codigo_misioneros").notNull().$defaultFn(nuevoCodigo),
  /** Alergias o preferencias de los misioneros actuales; se muestra al anotarse. */
  notaParaCocinar: text("nota_para_cocinar"),
  /** Contacto que aparece en el calendario imprimible. */
  contactoNombre: text("contacto_nombre"),
  contactoTelefono: text("contacto_telefono"),
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
  /** La presidenta pidió eliminar el barrio; no cambia nada hasta que el super admin lo borre. */
  eliminacionSolicitadaEn: integer("eliminacion_solicitada_en", { mode: "timestamp" }),
  motivoEliminacion: text("motivo_eliminacion"),
  creadoEn: creadoEn(),
});

// ---------- compañerismos ----------

export const companerismos = sqliteTable(
  "companerismos",
  {
    id: id(),
    barrioId: text("barrio_id")
      .notNull()
      .references(() => barrios.id, { onDelete: "cascade" }),
    tipo: text("tipo", { enum: ["elderes", "hermanas"] }).notNull(),
    /** Etiqueta visible: "Élderes", "Hermanas misioneras" */
    nombre: text("nombre").notNull(),
    /** Se desactiva si se van del barrio (traslados) sin perder el historial. */
    activo: integer("activo", { mode: "boolean" }).notNull().default(true),
    /** Orden de las columnas en la vista y el PDF. */
    orden: integer("orden").notNull().default(0),
    creadoEn: creadoEn(),
  },
  (t) => [index("companerismos_barrio_idx").on(t.barrioId)],
);

// ---------- administradores por barrio ----------

/**
 * Qué usuario (Better Auth) administra qué barrio.
 * El super admin (quien crea barrios) se maneja con el campo `role`
 * del plugin `admin` de Better Auth, no aquí.
 */
export const adminsBarrio = sqliteTable(
  "admins_barrio",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    barrioId: text("barrio_id")
      .notNull()
      .references(() => barrios.id, { onDelete: "cascade" }),
    /** Solo informativo: "Presidenta de la Sociedad de Socorro", "Líder misional"… */
    cargo: text("cargo"),
    creadoEn: creadoEn(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.barrioId] }),
    index("admins_barrio_barrio_idx").on(t.barrioId),
  ],
);

// ---------- meses ----------

export const meses = sqliteTable(
  "meses",
  {
    id: id(),
    barrioId: text("barrio_id")
      .notNull()
      .references(() => barrios.id, { onDelete: "cascade" }),
    anio: integer("anio").notNull(),
    /** 1–12 */
    mes: integer("mes").notNull(),
    /** borrador: solo admin · abierto: el público se anota · cerrado: solo lectura */
    estado: text("estado", { enum: ["borrador", "abierto", "cerrado"] })
      .notNull()
      .default("borrador"),

    // Personalización del calendario imprimible / imagen para WhatsApp
    /** Clave del objeto en R2 (no la URL pública). */
    imagenKey: text("imagen_key"),
    escritura: text("escritura"),
    escrituraRef: text("escritura_ref"),
    mensaje: text("mensaje"),
    plantilla: text("plantilla", { enum: ["azul", "dorado", "cielo"] })
      .notNull()
      .default("azul"),

    creadoEn: creadoEn(),
    actualizadoEn: actualizadoEn(),
  },
  (t) => [uniqueIndex("meses_barrio_periodo_uq").on(t.barrioId, t.anio, t.mes)],
);

// ---------- turnos ----------

export const turnos = sqliteTable(
  "turnos",
  {
    id: id(),
    mesId: text("mes_id")
      .notNull()
      .references(() => meses.id, { onDelete: "cascade" }),
    companerismoId: text("companerismo_id")
      .notNull()
      .references(() => companerismos.id, { onDelete: "cascade" }),
    /** 'YYYY-MM-DD' en la zona horaria del barrio; texto para evitar líos de zona horaria. */
    fecha: text("fecha").notNull(),
    /** Bloquear un día completo = bloquear los turnos de ambos compañerismos. */
    bloqueado: integer("bloqueado", { mode: "boolean" }).notNull().default(false),
    /** Motivo visible: "Conferencia de estaca" */
    motivoBloqueo: text("motivo_bloqueo"),
  },
  (t) => [
    uniqueIndex("turnos_companerismo_fecha_uq").on(t.companerismoId, t.fecha),
    index("turnos_mes_idx").on(t.mesId),
  ],
);

// ---------- inscripciones ----------

export const inscripciones = sqliteTable(
  "inscripciones",
  {
    id: id(),
    /** UNIQUE: un turno, una inscripción. Resuelve la carrera entre dos hermanas. */
    turnoId: text("turno_id")
      .notNull()
      .unique()
      .references(() => turnos.id, { onDelete: "cascade" }),

    /** Lo único que ve el público: "Hna. Pérez" */
    nombre: text("nombre").notNull(),
    /** Solo visible para misioneros y admins, y solo si hay consentimiento. */
    telefono: text("telefono"),
    consentimientoTelefono: integer("consentimiento_telefono", { mode: "boolean" })
      .notNull()
      .default(false),
    modalidad: text("modalidad", { enum: MODALIDADES }),
    /** Dirección u hora */
    nota: text("nota"),

    origen: text("origen", { enum: ["publico", "admin"] }).notNull(),
    /** Si la anotó un admin, quién fue. */
    creadoPorUserId: text("creado_por_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    /**
     * SHA-256 del token que queda en el localStorage de quien se anotó.
     * Se guarda el hash: con la base de datos no basta para editar lo ajeno.
     */
    tokenEdicionHash: text("token_edicion_hash"),

    creadoEn: creadoEn(),
    actualizadoEn: actualizadoEn(),
  },
  (t) => [index("inscripciones_token_idx").on(t.tokenEdicionHash)],
);

// ---------- solicitudes de acceso ----------

/**
 * Alguien que quiere usar la app en su barrio. El super admin la aprueba (crea el barrio y la
 * presidenta) o la rechaza a mano. Solo puede haber una `pendiente` por correo (índice único parcial).
 */
export const solicitudes = sqliteTable(
  "solicitudes",
  {
    id: id(),
    nombre: text("nombre").notNull(),
    /** En minúsculas. */
    email: text("email").notNull(),
    telefono: text("telefono").notNull(),
    /** Nombre del barrio tal como lo escribió. */
    barrio: text("barrio").notNull(),
    estaca: text("estaca"),
    ciudad: text("ciudad").notNull(),
    pais: text("pais").notNull(),
    idioma: text("idioma", { enum: IDIOMAS }).notNull(),
    zonaHoraria: text("zona_horaria").notNull(),
    /** Qué misioneros tiene el barrio; al menos uno de los dos. */
    tieneElderes: integer("tiene_elderes", { mode: "boolean" }).notNull(),
    tieneHermanas: integer("tiene_hermanas", { mode: "boolean" }).notNull(),
    mensaje: text("mensaje"),
    estado: text("estado", { enum: ESTADOS_SOLICITUD }).notNull().default("pendiente"),
    motivoRechazo: text("motivo_rechazo"),
    resueltaEn: integer("resuelta_en", { mode: "timestamp" }),
    resueltaPorUserId: text("resuelta_por_user_id").references(() => user.id, { onDelete: "set null" }),
    /** El barrio que se creó al aprobarla. */
    barrioId: text("barrio_id").references(() => barrios.id, { onDelete: "set null" }),
    creadoEn: creadoEn(),
  },
  (t) => [
    index("solicitudes_estado_idx").on(t.estado),
    // Una sola pendiente por correo, también si llegan dos a la vez (la API responde 409).
    uniqueIndex("solicitudes_email_pendiente_uq").on(t.email).where(sql`${t.estado} = 'pendiente'`),
  ],
);

// ---------- relaciones (para db.query.*) ----------

export const barriosRelations = relations(barrios, ({ many }) => ({
  companerismos: many(companerismos),
  meses: many(meses),
  admins: many(adminsBarrio),
}));

export const companerismosRelations = relations(companerismos, ({ one, many }) => ({
  barrio: one(barrios, { fields: [companerismos.barrioId], references: [barrios.id] }),
  turnos: many(turnos),
}));

export const adminsBarrioRelations = relations(adminsBarrio, ({ one }) => ({
  barrio: one(barrios, { fields: [adminsBarrio.barrioId], references: [barrios.id] }),
  user: one(user, { fields: [adminsBarrio.userId], references: [user.id] }),
}));

export const mesesRelations = relations(meses, ({ one, many }) => ({
  barrio: one(barrios, { fields: [meses.barrioId], references: [barrios.id] }),
  turnos: many(turnos),
}));

export const turnosRelations = relations(turnos, ({ one }) => ({
  mes: one(meses, { fields: [turnos.mesId], references: [meses.id] }),
  companerismo: one(companerismos, {
    fields: [turnos.companerismoId],
    references: [companerismos.id],
  }),
  // Lado inverso del uno-a-uno: los `fields` se declaran en inscripcionesRelations.
  inscripcion: one(inscripciones),
}));

export const inscripcionesRelations = relations(inscripciones, ({ one }) => ({
  turno: one(turnos, { fields: [inscripciones.turnoId], references: [turnos.id] }),
  creadoPor: one(user, {
    fields: [inscripciones.creadoPorUserId],
    references: [user.id],
  }),
}));

// ---------- tipos ----------

export type Barrio = typeof barrios.$inferSelect;
export type Companerismo = typeof companerismos.$inferSelect;
export type Mes = typeof meses.$inferSelect;
export type Turno = typeof turnos.$inferSelect;
export type Inscripcion = typeof inscripciones.$inferSelect;
export type NuevaInscripcion = typeof inscripciones.$inferInsert;
export type Solicitud = typeof solicitudes.$inferSelect;
