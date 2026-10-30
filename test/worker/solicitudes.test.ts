import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearDb } from "@/db";
import { solicitudes } from "@/db/schema";
import { capturarCorreos, crearAdmin, iniciarSesion, pedir, sembrar } from "./datos";

beforeEach(async () => {
  const db = await sembrar();
  await db.delete(solicitudes);
});

const fijarResendKey = (key: string) => {
  (env as unknown as { RESEND_API_KEY: string }).RESEND_API_KEY = key;
};

afterEach(() => {
  vi.restoreAllMocks();
  fijarResendKey("");
});

const SOLICITUD = {
  nombre: "Hna. Soto",
  email: "soto@ejemplo.cl",
  telefono: "+56 9 5555 4444",
  barrio: "Barrio Poniente",
  estaca: "Estaca Maipú",
  ciudad: "Santiago",
  pais: "Chile",
  idioma: "pt",
  zonaHoraria: "America/Santiago",
  companerismos: ["elderes", "hermanas"],
  mensaje: "Somos un barrio nuevo",
  turnstileToken: "token-de-prueba",
};

const URL_TURNSTILE = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const URL_RESEND = "https://api.resend.com/emails";

/**
 * `fetch` simulado: Turnstile responde `turnstile` y Resend `resend` (status). Devuelve lo que
 * recibió cada uno. Con `resend = null` Resend queda apagado (los correos van a la consola).
 */
function conServicios({ turnstile = true, resend = null }: { turnstile?: boolean; resend?: number | null } = {}) {
  if (resend !== null) fijarResendKey("re_test_123");
  const simulado = vi.spyOn(globalThis, "fetch").mockImplementation(async (entrada) => {
    const url = String(entrada instanceof Request ? entrada.url : entrada);
    if (url === URL_TURNSTILE) return Response.json({ success: turnstile });
    if (url === URL_RESEND) return Response.json(resend === 200 ? { id: "x" } : { message: "caído" }, { status: resend ?? 200 });
    throw new Error(`fetch inesperado: ${url}`);
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  return {
    turnstile: () => simulado.mock.calls.filter(([u]) => String(u) === URL_TURNSTILE),
    correos: () =>
      simulado.mock.calls
        .filter(([u]) => String(u) === URL_RESEND)
        .map(([, init]) => {
          const b = JSON.parse(String(init?.body));
          return { para: b.to[0] as string, asunto: b.subject as string, texto: b.text as string };
        }),
  };
}

const enviar = (json: object = SOLICITUD) => pedir("/api/solicitudes", { method: "POST", json });
const filas = () => crearDb(env.DB).select().from(solicitudes);

const comoSuperAdmin = async () => {
  await crearAdmin({ email: "root@ejemplo.cl", superAdmin: true });
  return iniciarSesion("root@ejemplo.cl");
};
const comoAdminDeBarrio = async () => {
  await crearAdmin({ email: "pres@ejemplo.cl", barrios: ["b1"] });
  return iniciarSesion("pres@ejemplo.cl");
};

const DATOS_BARRIO = {
  slug: "poniente",
  nombre: "Barrio Poniente",
  idioma: "pt",
  zonaHoraria: "America/Santiago",
  companerismos: [
    { tipo: "elderes", nombre: "Élderes" },
    { tipo: "hermanas", nombre: "Hermanas" },
  ],
  presidenta: { email: "soto@ejemplo.cl", nombre: "Hna. Soto" },
};

async function crearPendiente(extra: object = {}) {
  const res = await enviar({ ...SOLICITUD, ...extra });
  expect(res.status).toBe(201);
  return (await res.json<{ id: string }>()).id;
}

describe("POST /api/solicitudes", () => {
  it("una solicitud válida → 201 y queda pendiente", async () => {
    conServicios();
    const res = await enviar();
    expect(res.status).toBe(201);
    const { id } = await res.json<any>();
    const [fila] = await filas();
    expect(fila).toMatchObject({
      id,
      estado: "pendiente",
      email: "soto@ejemplo.cl",
      tieneElderes: true,
      tieneHermanas: true,
      idioma: "pt",
    });
  });

  it("guarda solo los compañerismos elegidos y el correo en minúsculas", async () => {
    conServicios();
    await enviar({ ...SOLICITUD, email: "  Soto@Ejemplo.CL ", companerismos: ["hermanas"] });
    const [fila] = await filas();
    expect(fila).toMatchObject({ email: "soto@ejemplo.cl", tieneElderes: false, tieneHermanas: true });
  });

  it("datos inválidos → 400 con los campos", async () => {
    conServicios();
    const res = await enviar({ ...SOLICITUD, email: "no-es-correo", companerismos: [] });
    expect(res.status).toBe(400);
    const cuerpo = await res.json<any>();
    expect(cuerpo.error).toBe("DATOS_INVALIDOS");
    expect(cuerpo.campos).toEqual(expect.arrayContaining(["email", "companerismos"]));
    expect(await filas()).toHaveLength(0);
  });

  it("Turnstile no validó → 400 VERIFICACION_FALLIDA y no se guarda", async () => {
    conServicios({ turnstile: false });
    const res = await enviar();
    expect(res.status).toBe(400);
    expect((await res.json<any>()).error).toBe("VERIFICACION_FALLIDA");
    expect(await filas()).toHaveLength(0);
  });

  it("verifica Turnstile con el secreto y el token", async () => {
    const s = conServicios();
    await enviar();
    const [[, init]] = s.turnstile();
    const cuerpo = init?.body as URLSearchParams;
    expect(cuerpo.get("secret")).toBe(env.TURNSTILE_SECRET_KEY);
    expect(cuerpo.get("response")).toBe("token-de-prueba");
  });

  it("segunda solicitud pendiente con el mismo correo → 409", async () => {
    conServicios();
    await crearPendiente();
    const res = await enviar({ ...SOLICITUD, email: "SOTO@ejemplo.cl" });
    expect(res.status).toBe(409);
    expect((await res.json<any>()).error).toBe("SOLICITUD_PENDIENTE");
    expect(await filas()).toHaveLength(1);
  });

  it("dos envíos a la vez con el mismo correo → solo uno queda guardado", async () => {
    conServicios();
    const respuestas = await Promise.all([enviar(), enviar()]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await filas()).toHaveLength(1);
  });

  it("la base no admite dos pendientes con el mismo correo", async () => {
    conServicios();
    await crearPendiente();
    const [fila] = await filas();
    const { id: _, creadoEn: __, ...copia } = fila;
    await expect(crearDb(env.DB).insert(solicitudes).values(copia)).rejects.toThrow();
  });

  it("si la anterior ya se resolvió, puede volver a pedir", async () => {
    conServicios();
    const id = await crearPendiente();
    const root = await comoSuperAdmin();
    await pedir(`/api/admin/solicitudes/${id}/rechazar`, { method: "POST", cookie: root, json: {} });
    expect((await enviar()).status).toBe(201);
  });
});

describe("límite por IP", () => {
  it("pasado el límite → 429 antes de validar", async () => {
    conServicios();
    const ip = "203.0.113.77";
    let ultimo = 0;
    for (let i = 0; i < 12 && ultimo !== 429; i++) {
      ultimo = (await pedir("/api/solicitudes", { method: "POST", json: {}, headers: { "cf-connecting-ip": ip } })).status;
    }
    expect(ultimo).toBe(429);
  });
});

describe("correos de una solicitud nueva", () => {
  it("manda dos: al super admin (por rol) y a quien pidió, en su idioma", async () => {
    await crearAdmin({ email: "root@ejemplo.cl", superAdmin: true });
    const s = conServicios({ resend: 200 });
    expect((await enviar()).status).toBe(201);

    await vi.waitFor(() => expect(s.correos()).toHaveLength(2));
    const aRoot = s.correos().find((c) => c.para === "root@ejemplo.cl")!;
    const aSolicitante = s.correos().find((c) => c.para === "soto@ejemplo.cl")!;
    expect(aRoot.asunto).toContain("Barrio Poniente");
    expect(aRoot.texto).toContain("Hna. Soto");
    expect(aRoot.texto).toContain("http://localhost/admin/solicitudes");
    expect(aSolicitante.asunto).toBe("Recebemos sua solicitação");
  });

  it("CORREO_SUPER_ADMIN manda sobre los usuarios con rol admin", async () => {
    await crearAdmin({ email: "root@ejemplo.cl", superAdmin: true });
    (env as unknown as { CORREO_SUPER_ADMIN: string }).CORREO_SUPER_ADMIN = "uno@ejemplo.cl, dos@ejemplo.cl";
    try {
      const s = conServicios({ resend: 200 });
      await enviar();
      await vi.waitFor(() => expect(s.correos()).toHaveLength(3));
      expect(s.correos().map((c) => c.para).sort()).toEqual(["dos@ejemplo.cl", "soto@ejemplo.cl", "uno@ejemplo.cl"]);
    } finally {
      delete (env as unknown as { CORREO_SUPER_ADMIN?: string }).CORREO_SUPER_ADMIN;
    }
  });

  it("si Resend falla la solicitud queda guardada igual", async () => {
    await crearAdmin({ email: "root@ejemplo.cl", superAdmin: true });
    const s = conServicios({ resend: 500 });
    const res = await enviar();
    expect(res.status).toBe(201);
    await vi.waitFor(() => expect(s.correos()).toHaveLength(2));
    expect(await filas()).toHaveLength(1);
  });

  it("sin RESEND_API_KEY los correos van a la consola", async () => {
    await crearAdmin({ email: "root@ejemplo.cl", superAdmin: true });
    conServicios();
    const correos = capturarCorreos();
    await enviar();
    await vi.waitFor(() => expect(correos()).toHaveLength(2));
  });
});

describe("GET /api/admin/solicitudes", () => {
  it("lista las pendientes con los compañerismos como lista y cuenta las pendientes", async () => {
    conServicios();
    await crearPendiente();
    await crearPendiente({ email: "otra@ejemplo.cl", companerismos: ["hermanas"] });
    const root = await comoSuperAdmin();

    const res = await pedir("/api/admin/solicitudes", { cookie: root });
    expect(res.status).toBe(200);
    const { solicitudes: lista, pendientes } = await res.json<any>();
    expect(pendientes).toBe(2);
    expect(lista).toHaveLength(2);
    expect(lista.map((s: any) => s.email).sort()).toEqual(["otra@ejemplo.cl", "soto@ejemplo.cl"]);
    const otra = lista.find((s: any) => s.email === "otra@ejemplo.cl");
    expect(otra).toMatchObject({ estado: "pendiente", companerismos: ["hermanas"], barrioSlug: null });
    expect(otra).not.toHaveProperty("tieneElderes");
  });

  it("filtra por estado", async () => {
    conServicios();
    const id = await crearPendiente();
    await crearPendiente({ email: "otra@ejemplo.cl" });
    const root = await comoSuperAdmin();
    await pedir(`/api/admin/solicitudes/${id}/rechazar`, { method: "POST", cookie: root, json: { motivo: "No hay misioneros" } });

    const rechazadas = await (await pedir("/api/admin/solicitudes?estado=rechazada", { cookie: root })).json<any>();
    expect(rechazadas.solicitudes).toHaveLength(1);
    expect(rechazadas.solicitudes[0]).toMatchObject({ id, motivoRechazo: "No hay misioneros" });
    expect(rechazadas.pendientes).toBe(1);
    expect((await pedir("/api/admin/solicitudes?estado=otra", { cookie: root })).status).toBe(400);
  });

  it("sin sesión → 401", async () => {
    expect((await pedir("/api/admin/solicitudes")).status).toBe(401);
  });
});

describe("POST /api/admin/solicitudes/:id/aprobar", () => {
  it("crea el barrio con sus compañerismos y la presidenta asignada, y marca la solicitud", async () => {
    conServicios();
    const id = await crearPendiente();
    const root = await comoSuperAdmin();

    const res = await pedir(`/api/admin/solicitudes/${id}/aprobar`, { method: "POST", cookie: root, json: DATOS_BARRIO });
    expect(res.status).toBe(201);
    const cuerpo = await res.json<any>();
    expect(cuerpo.barrio).toMatchObject({ slug: "poniente", nombre: "Barrio Poniente", idioma: "pt" });
    expect(cuerpo.companerismos.map((c: any) => c.tipo)).toEqual(["elderes", "hermanas"]);
    expect(cuerpo.presidenta).toMatchObject({ email: "soto@ejemplo.cl", cuentaNueva: true });
    expect(cuerpo.solicitud).toEqual({ id, estado: "aprobada" });

    const [fila] = await filas();
    expect(fila).toMatchObject({ estado: "aprobada" });
    expect(fila.resueltaEn).toBeInstanceOf(Date);
    expect(fila.barrioId).toBeTruthy();
    expect(fila.resueltaPorUserId).toBeTruthy();

    const presidenta = await iniciarSesion("soto@ejemplo.cl", cuerpo.presidenta.passwordTemporal);
    const yo = await (await pedir("/api/admin/yo", { cookie: presidenta })).json<any>();
    expect(yo.barrios.map((b: any) => b.slug)).toEqual(["poniente"]);

    const lista = await (await pedir("/api/admin/solicitudes?estado=aprobada", { cookie: root })).json<any>();
    expect(lista.solicitudes[0].barrioSlug).toBe("poniente");
  });

  it("no se puede aprobar dos veces → 409 SOLICITUD_RESUELTA", async () => {
    conServicios();
    const id = await crearPendiente();
    const root = await comoSuperAdmin();
    await pedir(`/api/admin/solicitudes/${id}/aprobar`, { method: "POST", cookie: root, json: DATOS_BARRIO });

    const res = await pedir(`/api/admin/solicitudes/${id}/aprobar`, { method: "POST", cookie: root, json: { ...DATOS_BARRIO, slug: "otro-slug" } });
    expect(res.status).toBe(409);
    expect((await res.json<any>()).error).toBe("SOLICITUD_RESUELTA");
  });

  it("aprobar y rechazar a la vez: solo una gana", async () => {
    conServicios();
    const id = await crearPendiente();
    const root = await comoSuperAdmin();
    const [aprobar, rechazar] = await Promise.all([
      pedir(`/api/admin/solicitudes/${id}/aprobar`, { method: "POST", cookie: root, json: DATOS_BARRIO }),
      pedir(`/api/admin/solicitudes/${id}/rechazar`, { method: "POST", cookie: root, json: {} }),
    ]);
    expect([aprobar.status, rechazar.status].filter((s) => s === 409)).toHaveLength(1);
    const [fila] = await filas();
    expect(fila.estado).toBe(aprobar.status === 201 ? "aprobada" : "rechazada");
  });

  it("slug existente → 409 SLUG_EXISTENTE y la solicitud sigue pendiente", async () => {
    conServicios();
    const id = await crearPendiente();
    const root = await comoSuperAdmin();
    const res = await pedir(`/api/admin/solicitudes/${id}/aprobar`, { method: "POST", cookie: root, json: { ...DATOS_BARRIO, slug: "prueba" } });
    expect(res.status).toBe(409);
    expect((await res.json<any>()).error).toBe("SLUG_EXISTENTE");
    expect((await filas())[0].estado).toBe("pendiente");
  });

  it("solicitud inexistente → 404; datos inválidos → 400", async () => {
    conServicios();
    const root = await comoSuperAdmin();
    expect((await pedir("/api/admin/solicitudes/nada/aprobar", { method: "POST", cookie: root, json: DATOS_BARRIO })).status).toBe(404);
    const id = await crearPendiente();
    const res = await pedir(`/api/admin/solicitudes/${id}/aprobar`, { method: "POST", cookie: root, json: { ...DATOS_BARRIO, slug: "Mal Slug" } });
    expect(res.status).toBe(400);
  });

  it("manda la bienvenida con un enlace válido y los primeros pasos", async () => {
    const s = conServicios({ resend: 200 });
    const id = await crearPendiente();
    await vi.waitFor(() => expect(s.correos()).toHaveLength(1)); // el acuse (sin super admin con rol)
    const root = await comoSuperAdmin();
    await vi.waitFor(() => expect(s.correos().length).toBeGreaterThanOrEqual(1));
    const antes = s.correos().length;

    await pedir(`/api/admin/solicitudes/${id}/aprobar`, { method: "POST", cookie: root, json: DATOS_BARRIO });
    const bienvenida = s.correos().slice(antes).find((c) => c.para === "soto@ejemplo.cl")!;
    expect(bienvenida.asunto).toContain("Boas-vindas");
    expect(bienvenida.texto).toContain("http://localhost/admin/poniente");
    const token = bienvenida.texto.match(/\/admin\/restablecer\?token=([A-Za-z0-9]+)/)![1];

    const nueva = await pedir("/api/auth/reset-password", { method: "POST", json: { token, newPassword: "mi-clave-propia-1" } });
    expect(nueva.status).toBe(200);
  });

  it("si Resend falla igual queda aprobada y el barrio creado", async () => {
    const s = conServicios({ resend: 500 });
    const id = await crearPendiente();
    const root = await comoSuperAdmin();
    const res = await pedir(`/api/admin/solicitudes/${id}/aprobar`, { method: "POST", cookie: root, json: DATOS_BARRIO });
    expect(res.status).toBe(201);
    expect((await res.json<any>()).presidenta.correoEnviado).toBe(false);
    expect((await filas())[0].estado).toBe("aprobada");
    expect(s.correos().length).toBeGreaterThan(0);
  });
});

describe("POST /api/admin/solicitudes/:id/rechazar", () => {
  it("guarda el motivo y quién la resolvió", async () => {
    conServicios();
    const id = await crearPendiente();
    const root = await comoSuperAdmin();
    const res = await pedir(`/api/admin/solicitudes/${id}/rechazar`, { method: "POST", cookie: root, json: { motivo: "Ya hay otro barrio" } });
    expect(res.status).toBe(200);
    expect((await res.json<any>()).solicitud).toEqual({ id, estado: "rechazada", motivoRechazo: "Ya hay otro barrio" });
    const [fila] = await filas();
    expect(fila).toMatchObject({ estado: "rechazada", motivoRechazo: "Ya hay otro barrio" });
    expect(fila.resueltaEn).toBeInstanceOf(Date);
    expect(fila.resueltaPorUserId).toBeTruthy();
  });

  it("el motivo es opcional", async () => {
    conServicios();
    const id = await crearPendiente();
    const root = await comoSuperAdmin();
    expect((await pedir(`/api/admin/solicitudes/${id}/rechazar`, { method: "POST", cookie: root, json: {} })).status).toBe(200);
    expect((await filas())[0].motivoRechazo).toBeNull();
  });

  it("ya resuelta → 409; inexistente → 404", async () => {
    conServicios();
    const id = await crearPendiente();
    const root = await comoSuperAdmin();
    await pedir(`/api/admin/solicitudes/${id}/rechazar`, { method: "POST", cookie: root, json: {} });
    const otra = await pedir(`/api/admin/solicitudes/${id}/rechazar`, { method: "POST", cookie: root, json: {} });
    expect(otra.status).toBe(409);
    expect((await otra.json<any>()).error).toBe("SOLICITUD_RESUELTA");
    expect((await pedir("/api/admin/solicitudes/nada/rechazar", { method: "POST", cookie: root, json: {} })).status).toBe(404);
  });

  it("manda el aviso a quien pidió, en su idioma y con el motivo", async () => {
    const s = conServicios({ resend: 200 });
    const id = await crearPendiente();
    const root = await comoSuperAdmin();
    await vi.waitFor(() => expect(s.correos()).toHaveLength(1));
    await pedir(`/api/admin/solicitudes/${id}/rechazar`, { method: "POST", cookie: root, json: { motivo: "Ya hay otro barrio" } });
    const aviso = s.correos().find((c) => c.asunto === "Sobre sua solicitação do Almoço Missionário")!;
    expect(aviso.para).toBe("soto@ejemplo.cl");
    expect(aviso.texto).toContain("Ya hay otro barrio");
  });

  it("si Resend falla igual queda rechazada", async () => {
    conServicios({ resend: 500 });
    const id = await crearPendiente();
    const root = await comoSuperAdmin();
    const res = await pedir(`/api/admin/solicitudes/${id}/rechazar`, { method: "POST", cookie: root, json: { motivo: "x" } });
    expect(res.status).toBe(200);
    expect((await filas())[0].estado).toBe("rechazada");
  });
});

describe("permisos", () => {
  it("un admin de barrio recibe 403 SIN_PERMISO al listar, aprobar y rechazar", async () => {
    conServicios();
    const id = await crearPendiente();
    const pres = await comoAdminDeBarrio();
    for (const [ruta, metodo, json] of [
      ["/api/admin/solicitudes", "GET", undefined],
      [`/api/admin/solicitudes/${id}/aprobar`, "POST", DATOS_BARRIO],
      [`/api/admin/solicitudes/${id}/rechazar`, "POST", {}],
    ] as const) {
      const res = await pedir(ruta, { method: metodo, cookie: pres, json });
      expect(res.status, ruta).toBe(403);
      expect((await res.json<any>()).error).toBe("SIN_PERMISO");
    }
    expect((await filas())[0].estado).toBe("pendiente");
  });
});
