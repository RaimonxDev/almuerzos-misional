import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { contarTurnos } from "@/app/pantallas/admin/mes";
import { renderizarApp, simularApi } from "./utilidades";

// Meses en 2099: ningún día queda en el pasado, no depende de la fecha en que corran los tests.

const YO = {
  usuario: { id: "u-1", email: "presidenta@ejemplo.cl", nombre: "Presidenta", superAdmin: false },
  barrios: [{ slug: "centro", nombre: "Barrio Centro", cargo: "Presidenta de la Sociedad de Socorro" }],
};

const COMPANERISMOS = [
  { id: "c-e", tipo: "elderes", nombre: "Élderes", activo: true, orden: 0 },
  { id: "c-h", tipo: "hermanas", nombre: "Hermanas", activo: true, orden: 1 },
];

const barrio = (tokenMisioneros = "tok-viejo") => ({
  barrio: {
    slug: "centro",
    nombre: "Barrio Centro",
    idioma: "es",
    zonaHoraria: "America/Santiago",
    tokenMisioneros,
    notaParaCocinar: "Élder Soto es alérgico al maní",
    contactoNombre: null,
    contactoTelefono: null,
  },
  companerismos: COMPANERISMOS,
});

const resumen = (periodo: string, estado: string) => ({
  periodo,
  anio: Number(periodo.slice(0, 4)),
  mes: Number(periodo.slice(5)),
  estado,
  turnos: 60,
  tomados: 2,
  bloqueados: 3,
});

const turno = (id: string, fecha: string, companerismoId: string, extra: object = {}) => ({
  id,
  fecha,
  companerismoId,
  bloqueado: false,
  motivoBloqueo: null,
  inscripcion: null,
  ...extra,
});

const inscripcion = (id: string, nombre: string, extra: object = {}) => ({
  id,
  nombre,
  telefono: null,
  consentimientoTelefono: false,
  modalidad: null,
  nota: null,
  origen: "publico",
  ...extra,
});

const mes = (periodo: string, estado: string, companerismos = COMPANERISMOS, turnos = TURNOS_ABRIL) => ({
  mes: {
    periodo,
    anio: Number(periodo.slice(0, 4)),
    mes: Number(periodo.slice(5)),
    estado,
    imagenKey: null,
    escritura: null,
    escrituraRef: null,
    mensaje: null,
    plantilla: "azul",
  },
  companerismos,
  turnos,
});

/**
 * 1 de abril: Pérez (con consentimiento) y González (sin consentimiento).
 * 2 de abril: día completo bloqueado; uno de sus turnos conserva una inscripción.
 * 3 de abril: élderes bloqueado, hermanas libre.
 */
const TURNOS_ABRIL = [
  turno("t1e", "2099-04-01", "c-e", {
    inscripcion: inscripcion("i-perez", "Hna. Pérez", {
      telefono: "+56 9 1234 5678",
      consentimientoTelefono: true,
      modalidad: "en_casa",
      nota: "13:30, Los Aromos 123",
    }),
  }),
  // La API no manda el teléfono sin consentimiento; si llegara, el panel tampoco lo muestra.
  turno("t1h", "2099-04-01", "c-h", { inscripcion: inscripcion("i-gonzalez", "Hna. González", { telefono: "+56 9 8765 4321" }) }),
  turno("t2e", "2099-04-02", "c-e", {
    bloqueado: true,
    motivoBloqueo: "Conferencia de estaca",
    inscripcion: inscripcion("i-rojas", "Hna. Rojas"),
  }),
  turno("t2h", "2099-04-02", "c-h", { bloqueado: true, motivoBloqueo: "Conferencia de estaca" }),
  turno("t3e", "2099-04-03", "c-e", { bloqueado: true }),
  turno("t3h", "2099-04-03", "c-h"),
];

const RUTA_BARRIO = "/api/admin/barrios/centro";

/** Respuestas por defecto; las de `extra` se agregan o las reemplazan. */
function simular(extra: Parameters<typeof simularApi>[0] = {}) {
  const base: Parameters<typeof simularApi>[0] = {
    "/api/admin/yo": { json: YO },
    [`${RUTA_BARRIO}/meses/2099-04`]: { json: mes("2099-04", "abierto") },
    [`${RUTA_BARRIO}/meses/2099-03`]: { json: mes("2099-03", "cerrado", COMPANERISMOS.slice(0, 1), []) },
    [`${RUTA_BARRIO}/meses`]: { json: { meses: [resumen("2099-03", "cerrado"), resumen("2099-04", "abierto")] } },
    [RUTA_BARRIO]: { json: barrio() },
  };
  return simularApi({ ...base, ...extra });
}

/** Llamadas a la API con ese método y esa URL, con su cuerpo ya leído. */
const llamadas = (api: ReturnType<typeof simularApi>, metodo: string, url: string) =>
  api.mock.calls
    .filter(([entrada, init]) => (init?.method ?? "GET") === metodo && String(entrada).endsWith(url))
    .map(([, init]) => (init?.body ? JSON.parse(String(init.body)) : undefined));

const abrirPanel = async (url = "/admin/centro?mes=2099-04") => {
  renderizarApp(url);
  await screen.findByRole("heading", { level: 1, name: "Abril 2099" });
  await screen.findByText("Hna. Pérez");
};

const encabezados = () => screen.getAllByRole("columnheader").map((th) => th.textContent);

let api: ReturnType<typeof simularApi>;
beforeEach(() => {
  api = simular();
});

describe("contarTurnos", () => {
  it("cuenta tomados y libres sin los turnos bloqueados, y los días con todo bloqueado", () => {
    expect(contarTurnos(TURNOS_ABRIL)).toEqual({ total: 3, tomados: 2, libres: 1, diasBloqueados: 1 });
  });
});

describe("Panel: tabla del mes", () => {
  it("genera las columnas desde los compañerismos del mes", async () => {
    const tres = [...COMPANERISMOS, { id: "c-i", tipo: "elderes", nombre: "Élderes Inglés", activo: true, orden: 2 }];
    api = simular({ [`${RUTA_BARRIO}/meses/2099-04`]: { json: mes("2099-04", "abierto", tres) } });
    await abrirPanel();
    expect(encabezados()).toEqual(["Día", "Élderes", "Hermanas", "Élderes Inglés", "Acciones"]);
  });

  it("otro mes con otros compañerismos cambia las columnas", async () => {
    const user = userEvent.setup();
    await abrirPanel();
    await user.click(screen.getByRole("button", { name: /Marzo 2099/ }));
    await screen.findByRole("heading", { level: 1, name: "Marzo 2099" });
    await waitFor(() => expect(encabezados()).toEqual(["Día", "Élderes", "Acciones"]));
  });

  it("muestra el teléfono y WhatsApp solo con consentimiento", async () => {
    await abrirPanel();
    expect(screen.getByText("+56 9 1234 5678")).toBeInTheDocument();
    const whatsapp = screen.getByRole("link", { name: "Escribir a Hna. Pérez por WhatsApp" });
    expect(whatsapp.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/56912345678/);

    expect(screen.getByText("Hna. González")).toBeInTheDocument();
    expect(screen.queryByText("+56 9 8765 4321")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Escribir a Hna. González por WhatsApp" })).not.toBeInTheDocument();
  });

  it("los contadores no cuentan los turnos bloqueados", async () => {
    await abrirPanel();
    const tomados = screen.getByRole("group", { name: "Turnos tomados" });
    expect(tomados).toHaveTextContent("2");
    expect(tomados).toHaveTextContent("de 3");
    expect(screen.getByRole("group", { name: "Libres" })).toHaveTextContent("1");
    expect(screen.getByRole("group", { name: "Días bloqueados" })).toHaveTextContent("1");
  });

  it("un turno bloqueado muestra el motivo y no el nombre como tomado", async () => {
    await abrirPanel();
    expect(screen.getAllByText("Bloqueado: Conferencia de estaca")).toHaveLength(2);
    expect(screen.getByText("Anotada: Hna. Rojas")).toBeInTheDocument();
  });

  it("asigna a mano un turno libre", async () => {
    const user = userEvent.setup();
    api = simular({ [`${RUTA_BARRIO}/turnos/t3h/inscripcion`]: { status: 201, json: { inscripcion: inscripcion("i-nueva", "Familia Muñoz") } } });
    await abrirPanel();

    await user.click(screen.getByRole("button", { name: /^Asignar/ }));
    const dialogo = await screen.findByRole("dialog");
    await user.type(within(dialogo).getByLabelText("¿Quién da el almuerzo?"), "Familia Muñoz");
    await user.click(within(dialogo).getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(llamadas(api, "POST", "/turnos/t3h/inscripcion")).toEqual([
        expect.objectContaining({ nombre: "Familia Muñoz" }),
      ]),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("bloquea un día completo con su motivo", async () => {
    const user = userEvent.setup();
    api = simular({ [`${RUTA_BARRIO}/dias/2099-04-01`]: { json: { dia: { fecha: "2099-04-01", bloqueado: true, motivoBloqueo: "Bautismo", turnos: 2 } } } });
    await abrirPanel();

    await user.click(screen.getByRole("button", { name: /Bloquear el .*1 de abril/ }));
    const dialogo = await screen.findByRole("dialog");
    await user.type(within(dialogo).getByLabelText(/Motivo/), "Bautismo");
    await user.click(within(dialogo).getByRole("button", { name: "Bloquear" }));

    await waitFor(() =>
      expect(llamadas(api, "PATCH", "/dias/2099-04-01")).toEqual([{ bloqueado: true, motivo: "Bautismo" }]),
    );
  });

  it("desbloquea un día que ya está bloqueado, sin preguntar", async () => {
    const user = userEvent.setup();
    api = simular({ [`${RUTA_BARRIO}/dias/2099-04-02`]: { json: { dia: { fecha: "2099-04-02", bloqueado: false, motivoBloqueo: null, turnos: 2 } } } });
    await abrirPanel();

    await user.click(screen.getByRole("button", { name: /Desbloquear el .*2 de abril/ }));
    await waitFor(() => expect(llamadas(api, "PATCH", "/dias/2099-04-02")).toEqual([{ bloqueado: false }]));
  });

  it("bloquea un solo turno desde sus opciones", async () => {
    const user = userEvent.setup();
    api = simular({ [`${RUTA_BARRIO}/turnos/t3h`]: { json: { turno: { id: "t3h", fecha: "2099-04-03", bloqueado: true, motivoBloqueo: null } } } });
    await abrirPanel();

    await user.click(screen.getByRole("button", { name: /Opciones: Hermanas, .*3 de abril/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Bloquear turno" }));
    const dialogo = await screen.findByRole("dialog");
    await user.click(within(dialogo).getByRole("button", { name: "Bloquear" }));

    await waitFor(() => expect(llamadas(api, "PATCH", "/turnos/t3h")).toEqual([{ bloqueado: true, motivo: "" }]));
  });

  it("quita una inscripción después de confirmar", async () => {
    const user = userEvent.setup();
    api = simular({ [`${RUTA_BARRIO}/inscripciones/i-perez`]: { status: 204 } });
    await abrirPanel();

    await user.click(screen.getByRole("button", { name: /Opciones: Élderes, .*1 de abril/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Quitar" }));
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText("¿Quitar a Hna. Pérez?")).toBeInTheDocument();
    expect(llamadas(api, "DELETE", "/inscripciones/i-perez")).toHaveLength(0);

    await user.click(within(dialogo).getByRole("button", { name: "Sí, quitar" }));
    await waitFor(() => expect(llamadas(api, "DELETE", "/inscripciones/i-perez")).toHaveLength(1));
  });

  it("al editar sin consentimiento no puede darlo y solo manda lo que cambió", async () => {
    const user = userEvent.setup();
    api = simular({ [`${RUTA_BARRIO}/inscripciones/i-gonzalez`]: { json: { inscripcion: inscripcion("i-gonzalez", "Hna. González R.") } } });
    await abrirPanel();

    await user.click(screen.getByRole("button", { name: /Opciones: Hermanas, .*1 de abril/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Editar" }));
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByRole("checkbox")).toHaveAttribute("aria-disabled", "true");
    expect(within(dialogo).getByText("Solo la persona puede autorizar que se vea su teléfono.")).toBeInTheDocument();

    await user.type(within(dialogo).getByLabelText("¿Quién da el almuerzo?"), " R.");
    await user.click(within(dialogo).getByRole("button", { name: "Guardar" }));

    // Sin "telefono": el panel no lo conoce y mandarlo vacío lo borraría.
    await waitFor(() =>
      expect(llamadas(api, "PATCH", "/inscripciones/i-gonzalez")).toEqual([{ nombre: "Hna. González R." }]),
    );
  });
});

describe("Panel: enlaces, misioneros y gestión del mes", () => {
  it("muestra los enlaces del barrio", async () => {
    await abrirPanel();
    expect(screen.getByText(`${location.origin}/centro`)).toBeInTheDocument();
    expect(screen.getByText(`${location.origin}/centro/m/tok-viejo`)).toBeInTheDocument();
  });

  it("copia el enlace de los misioneros", async () => {
    const user = userEvent.setup();
    await abrirPanel();
    await user.click(screen.getByRole("button", { name: "Copiar el enlace para los misioneros" }));
    expect(await navigator.clipboard.readText()).toBe(`${location.origin}/centro/m/tok-viejo`);
  });

  it("regenerar el enlace pide confirmación", async () => {
    const user = userEvent.setup();
    api = simular({ [`${RUTA_BARRIO}/token-misioneros`]: { json: { tokenMisioneros: "tok-nuevo" } } });
    await abrirPanel();

    await user.click(screen.getByRole("button", { name: /Regenerar enlace/ }));
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText("¿Regenerar el enlace de los misioneros?")).toBeInTheDocument();
    expect(llamadas(api, "POST", "/token-misioneros")).toHaveLength(0);

    await user.click(within(dialogo).getByRole("button", { name: "No, mantenerlo" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(llamadas(api, "POST", "/token-misioneros")).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: /Regenerar enlace/ }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Sí, regenerar" }));
    expect(await screen.findByText(`${location.origin}/centro/m/tok-nuevo`)).toBeInTheDocument();
    expect(llamadas(api, "POST", "/token-misioneros")).toHaveLength(1);
  });

  it("el cambio de estado refleja el nuevo estado", async () => {
    const user = userEvent.setup();
    let estado = "abierto";
    api = simular({
      [`${RUTA_BARRIO}/meses/2099-04`]: (init) => {
        if (init?.method === "PATCH") estado = JSON.parse(String(init.body)).estado;
        return { json: init?.method === "PATCH" ? { mes: resumen("2099-04", estado) } : mes("2099-04", estado) };
      },
      [`${RUTA_BARRIO}/meses`]: () => ({ json: { meses: [resumen("2099-03", "cerrado"), resumen("2099-04", estado)] } }),
    });
    await abrirPanel();
    expect(screen.getByText("Abierto: las hermanas pueden anotarse con el enlace del barrio.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cerrar mes" }));

    expect(await screen.findByRole("button", { name: "Reabrir" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cerrar mes" })).not.toBeInTheDocument();
    expect(screen.getByText("Cerrado: ya no recibe anotaciones. Los misioneros y tú lo siguen viendo.")).toBeInTheDocument();
    expect(llamadas(api, "PATCH", "/meses/2099-04")).toEqual([{ estado: "cerrado" }]);
  });

  it("crea el mes siguiente en borrador y lo muestra", async () => {
    const user = userEvent.setup();
    let creado = false;
    api = simular({
      [`${RUTA_BARRIO}/meses/2099-05`]: { json: mes("2099-05", "borrador", COMPANERISMOS, []) },
      [`${RUTA_BARRIO}/meses`]: (init) => {
        if (init?.method === "POST") {
          creado = true;
          return { status: 201, json: { mes: { ...resumen("2099-05", "borrador"), turnos: 62 } } };
        }
        const lista = [resumen("2099-03", "cerrado"), resumen("2099-04", "abierto")];
        return { json: { meses: creado ? [...lista, resumen("2099-05", "borrador")] : lista } };
      },
    });
    await abrirPanel();

    await user.click(screen.getByRole("button", { name: "Crear Mayo 2099" }));

    expect(await screen.findByRole("button", { name: "Abrir para anotarse" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Mayo 2099" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Mayo 2099 creado en borrador con 62 turnos");
    expect(llamadas(api, "POST", "/meses")).toEqual([{ periodo: "2099-05" }]);
  });

  it("guarda la nota para cocinar", async () => {
    const user = userEvent.setup();
    api = simular({ [RUTA_BARRIO]: (init) => ({ json: init?.method === "PATCH" ? { barrio: barrio().barrio } : barrio() }) });
    await abrirPanel();

    const nota = screen.getByLabelText("Alergias o preferencias");
    expect(nota).toHaveValue("Élder Soto es alérgico al maní");
    await user.clear(nota);
    await user.type(nota, "Sin mariscos");
    await user.click(screen.getByRole("button", { name: "Guardar nota" }));

    await waitFor(() => expect(llamadas(api, "PATCH", RUTA_BARRIO)).toEqual([{ notaParaCocinar: "Sin mariscos" }]));
  });

  it("activa y desactiva compañerismos", async () => {
    const user = userEvent.setup();
    api = simular({
      [`${RUTA_BARRIO}/companerismos/c-h`]: { json: { companerismo: { ...COMPANERISMOS[1], activo: false } } },
    });
    await abrirPanel();

    await user.click(screen.getByRole("button", { name: "Desactivar Hermanas" }));
    await waitFor(() => expect(llamadas(api, "PATCH", "/companerismos/c-h")).toEqual([{ activo: false }]));
  });

  it("agrega un compañerismo con su tipo; sin nombre usa el del tipo", async () => {
    const user = userEvent.setup();
    const nuevo = { id: "c-n", tipo: "hermanas", nombre: "Hermanas", activo: true, orden: 2 };
    api = simular({ [`${RUTA_BARRIO}/companerismos`]: { status: 201, json: { companerismo: nuevo } } });
    await abrirPanel();

    await user.click(screen.getByRole("button", { name: "Agregar compañerismo" }));
    await user.click(screen.getByRole("radio", { name: "Hermanas" }));
    await user.click(screen.getByRole("button", { name: "Agregar" }));
    await waitFor(() => expect(llamadas(api, "POST", "/companerismos")).toEqual([{ tipo: "hermanas", nombre: "Hermanas" }]));

    await user.click(screen.getByRole("button", { name: "Agregar compañerismo" }));
    await user.type(screen.getByLabelText("Nombre"), "Élderes Inglés");
    await user.click(screen.getByRole("button", { name: "Agregar" }));
    await waitFor(() => expect(llamadas(api, "POST", "/companerismos")).toHaveLength(2));
    expect(llamadas(api, "POST", "/companerismos")[1]).toEqual({ tipo: "elderes", nombre: "Élderes Inglés" });
  });

  it("una presidenta no ve la lista de administradores", async () => {
    await abrirPanel();
    expect(screen.queryByRole("heading", { name: "Administradores" })).not.toBeInTheDocument();
    expect(llamadas(api, "GET", `${RUTA_BARRIO}/admins`)).toHaveLength(0);
  });

  it("el super admin ve los administradores y reenvía la invitación a quien no creó su contraseña", async () => {
    const user = userEvent.setup();
    api = simular({
      "/api/admin/yo": { json: { ...YO, usuario: { ...YO.usuario, superAdmin: true } } },
      [`${RUTA_BARRIO}/admins/u-9/invitacion`]: { json: { correoEnviado: true } },
      [`${RUTA_BARRIO}/admins`]: {
        json: {
          admins: [
            { id: "u-9", email: "rojas@ejemplo.cl", nombre: "Hna. Rojas", cargo: "Presidenta", debeCambiarPassword: true },
            { id: "u-8", email: "soto@ejemplo.cl", nombre: "Hna. Soto", cargo: null, debeCambiarPassword: false },
          ],
        },
      },
    });
    await abrirPanel();

    const seccion = (await screen.findByRole("heading", { name: "Administradores" })).closest("section")!;
    expect(await within(seccion).findByText("Hna. Rojas")).toBeInTheDocument();
    expect(within(seccion).getByText("Presidenta · rojas@ejemplo.cl")).toBeInTheDocument();
    expect(within(seccion).getAllByText("Aún no crea su contraseña")).toHaveLength(1);

    await user.click(within(seccion).getByRole("button", { name: "Reenviar la invitación a Hna. Rojas" }));
    await waitFor(() => expect(llamadas(api, "POST", `${RUTA_BARRIO}/admins/u-9/invitacion`)).toHaveLength(1));
  });

  it("sin selector de barrio si administra uno solo", async () => {
    await abrirPanel();
    expect(screen.queryByRole("combobox", { name: "Barrio" })).not.toBeInTheDocument();
    expect(screen.getByText("Barrio Centro")).toBeInTheDocument();
  });

  it("con más de un barrio, el selector lleva al otro", async () => {
    const user = userEvent.setup();
    const dos = { ...YO, barrios: [...YO.barrios, { slug: "oriente", nombre: "Barrio Oriente", cargo: null }] };
    simular({
      "/api/admin/yo": { json: dos },
      "/api/admin/barrios/oriente/meses": { json: { meses: [] } },
      "/api/admin/barrios/oriente": { json: { ...barrio(), barrio: { ...barrio().barrio, slug: "oriente", nombre: "Barrio Oriente" } } },
    });
    await abrirPanel();

    await user.click(screen.getByRole("combobox", { name: "Barrio" }));
    await user.click(await screen.findByRole("option", { name: "Barrio Oriente" }));
    expect(await screen.findByText("Todavía no hay meses. Crea el primero para empezar.")).toBeInTheDocument();
  });

  it("/admin lleva al primer barrio que administra, en el próximo mes", async () => {
    renderizarApp("/admin");
    expect(await screen.findByRole("heading", { level: 1, name: "Marzo 2099" })).toBeInTheDocument();
  });

  it("sin sesión, /admin lleva al login", async () => {
    simularApi({ "/api/admin/yo": { status: 401, json: { error: "NO_AUTORIZADO" } } });
    renderizarApp("/admin/centro");
    expect(await screen.findByLabelText("Contraseña")).toBeInTheDocument();
  });
});
