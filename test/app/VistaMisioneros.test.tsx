import { act, screen, waitFor, within } from "@testing-library/react";
import { focusManager } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { VistaMisioneros } from "@/app/pantallas/VistaMisioneros";
import { renderizarApp, renderizarRuta, simularApi } from "./utilidades";

const HOY = "2026-11-05";
const TOKEN = "token-secreto-de-misioneros";
const CLAVE_TOKEN = "almuerzo-misional:misioneros:centro";
const CODIGO_CAMBIO = "El código cambió. Pídele el nuevo a la presidenta de la Sociedad de Socorro.";

const turno = (id: string, fecha: string, companerismoId: string, extra: object = {}) => ({
  id,
  fecha,
  companerismoId,
  estado: "libre",
  nombre: null,
  telefono: null,
  modalidad: null,
  nota: null,
  motivoBloqueo: null,
  ...extra,
});

const barrio = (idioma = "es") => ({
  json: {
    barrio: { slug: "centro", nombre: "Barrio Centro", idioma, zonaHoraria: "America/Santiago" },
    meses: [
      { anio: 2026, mes: 11, estado: "abierto" },
      { anio: 2026, mes: 12, estado: "cerrado" },
    ],
    hoy: HOY,
  },
});

const noviembre = {
  json: {
    mes: { anio: 2026, mes: 11, estado: "abierto" },
    companerismos: [
      { id: "c-e", nombre: "Élderes", tipo: "elderes" },
      { id: "c-h", nombre: "Hermanas", tipo: "hermanas" },
    ],
    turnos: [
      turno("t-05e", "2026-11-05", "c-e", {
        estado: "tomado",
        nombre: "Hna. Pérez",
        telefono: "+56 9 1234-5678",
        modalidad: "en_casa",
        nota: "13:30, Los Aromos 123",
      }),
      turno("t-05h", "2026-11-05", "c-h", { estado: "tomado", nombre: "Hna. González", modalidad: "llevar" }),
      turno("t-06e", "2026-11-06", "c-e"),
      turno("t-15e", "2026-11-15", "c-e", { estado: "bloqueado", motivoBloqueo: "Conferencia de estaca" }),
    ],
    hoy: HOY,
  },
};

const diciembre = {
  json: {
    mes: { anio: 2026, mes: 12, estado: "cerrado" },
    companerismos: [{ id: "c-e", nombre: "Élderes", tipo: "elderes" }],
    turnos: [turno("t-dic", "2026-12-03", "c-e", { estado: "tomado", nombre: "Familia Muñoz" })],
    hoy: HOY,
  },
};

/** Lo público del barrio: la pantalla del código muestra su nombre y usa su idioma. */
const publico = (idioma = "es") => ({
  json: {
    barrio: { slug: "centro", nombre: "Barrio Centro", idioma, zonaHoraria: "America/Santiago", notaParaCocinar: null },
    mesesAbiertos: [],
    hoy: HOY,
  },
});

let api: ReturnType<typeof simularApi>;
const simular = (idioma = "es", extra: Parameters<typeof simularApi>[0] = {}) => {
  api = simularApi({
    "/api/barrios/centro": publico(idioma),
    "/api/barrios/centro/misioneros/meses/2026-11": noviembre,
    "/api/barrios/centro/misioneros/meses/2026-12": diciembre,
    "/api/barrios/centro/misioneros": barrio(idioma),
    ...extra,
  });
};

const TOKEN_INVALIDO = { status: 404, json: { error: "TOKEN_INVALIDO" } };

/** Este teléfono ya había entrado con el código. */
beforeEach(() => {
  simular();
  localStorage.setItem(CLAVE_TOKEN, TOKEN);
});

const renderizar = () => renderizarRuta("/:barrio/m", "/centro/m", <VistaMisioneros />);

const autorizacion = (url: string) =>
  api.mock.calls.filter(([e]) => String(e).endsWith(url)).map(([, init]) => new Headers(init?.headers).get("Authorization"));

describe("entrar con el código", () => {
  beforeEach(() => localStorage.removeItem(CLAVE_TOKEN));

  it("sin token pide el código; con el correcto guarda el token y muestra el calendario", async () => {
    simular("es", { "/api/barrios/centro/misioneros/acceso": { json: { token: TOKEN } } });
    renderizar();
    expect(await screen.findByRole("heading", { name: "Barrio Centro" })).toBeInTheDocument();
    expect(screen.queryByText("Hna. Pérez")).not.toBeInTheDocument();

    // Al completar las 6 casillas entra sin tocar "Entrar"; las minúsculas pasan a mayúsculas.
    await userEvent.type(screen.getByLabelText("Código de acceso"), "k7pm2x");

    expect(await screen.findByText("Hna. Pérez")).toBeInTheDocument();
    const [envio] = api.mock.calls.filter(([e]) => String(e).endsWith("/misioneros/acceso"));
    expect(JSON.parse(String(envio[1]!.body))).toEqual({ codigo: "K7PM2X" });
    expect(localStorage.getItem(CLAVE_TOKEN)).toBe(TOKEN);
    // El token va en el header, nunca en la URL de la API.
    expect(autorizacion("/api/barrios/centro/misioneros")).toEqual([`Bearer ${TOKEN}`]);
    expect(api.mock.calls.some(([e]) => String(e).includes(TOKEN))).toBe(false);
  });

  it("código incorrecto o demasiados intentos: mensajes traducidos, sin entrar", async () => {
    let respuesta = { status: 404, json: { error: "CODIGO_INVALIDO" } };
    simular("es", { "/api/barrios/centro/misioneros/acceso": () => respuesta });
    renderizar();
    await userEvent.type(await screen.findByLabelText("Código de acceso"), "AAAAAA");
    expect(await screen.findByText("Ese código no es correcto. Revísalo o pídeselo a la presidenta.")).toBeInTheDocument();

    respuesta = { status: 429, json: { error: "DEMASIADOS_INTENTOS" } };
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/intentos/i);
    expect(localStorage.getItem(CLAVE_TOKEN)).toBeNull();
  });

  it("pegar el código con guion o espacios lo deja en las casillas, listo para entrar", async () => {
    simular("es", { "/api/barrios/centro/misioneros/acceso": { json: { token: TOKEN } } });
    renderizar();
    await userEvent.click(await screen.findByLabelText("Código de acceso"));
    await userEvent.paste("k7p-m2x");

    expect(await screen.findByText("Hna. Pérez")).toBeInTheDocument();
    const [envio] = api.mock.calls.filter(([e]) => String(e).endsWith("/misioneros/acceso"));
    expect(JSON.parse(String(envio[1]!.body))).toEqual({ codigo: "K7PM2X" });
  });

  it("un enlace viejo con token en la URL lleva a la pantalla del código, sin usar ese token", async () => {
    renderizarApp("/centro/m/token-de-un-enlace-viejo");
    expect(await screen.findByLabelText("Código de acceso")).toBeInTheDocument();
    expect(api.mock.calls.some(([e, init]) => `${String(e)} ${JSON.stringify(init ?? {})}`.includes("token-de-un-enlace-viejo"))).toBe(
      false,
    );
  });
});

describe("VistaMisioneros", () => {
  it("muestra quién da el almuerzo, la modalidad y la dirección u hora", async () => {
    renderizar();
    expect(await screen.findByRole("heading", { name: "Barrio Centro" })).toBeInTheDocument();
    expect(screen.getByText("Noviembre 2026")).toBeInTheDocument();
    expect(await screen.findByText("Hna. Pérez")).toBeInTheDocument();
    expect(screen.getByText("En su casa")).toBeInTheDocument();
    expect(screen.getByText("13:30, Los Aromos 123")).toBeInTheDocument();
    expect(screen.getByText("Les llevan el almuerzo")).toBeInTheDocument();
    expect(screen.getByText("Nadie anotado todavía")).toBeInTheDocument();
    expect(screen.getByText("Sin almuerzo: Conferencia de estaca")).toBeInTheDocument();
  });

  it("con consentimiento muestra el teléfono y el botón a WhatsApp con el número normalizado", async () => {
    renderizar();
    const boton = await screen.findByRole("link", { name: "Escribir a Hna. Pérez por WhatsApp" });
    const href = boton.getAttribute("href")!;
    expect(href).toMatch(/^https:\/\/wa\.me\/56912345678\?text=/);
    expect(decodeURIComponent(href)).toContain("¡Hola, Hna. Pérez!");
    expect(decodeURIComponent(href)).toContain("por el almuerzo del jueves 5 de noviembre.");
    // El enlace a WhatsApp no debe llevar la URL con el token como referer.
    expect(boton).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
    expect(screen.getByText("+56 9 1234-5678")).toBeInTheDocument();
  });

  it("sin consentimiento no hay teléfono ni botón", async () => {
    renderizar();
    await screen.findByText("Hna. González");
    expect(screen.getAllByRole("link", { name: /whatsapp/i })).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "Escribir a Hna. González por WhatsApp" })).not.toBeInTheDocument();
    expect(screen.getByText("Sin teléfono compartido")).toBeInTheDocument();
  });

  it("manda el token en el header, nunca en la URL ni en el título", async () => {
    renderizar();
    await screen.findByText("Hna. Pérez");
    for (const [entrada, init] of api.mock.calls) {
      expect(String(entrada)).not.toContain(TOKEN);
      expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${TOKEN}`);
    }
    expect(document.title).toContain("Barrio Centro");
    expect(document.title).not.toContain(TOKEN);
  });

  it("recorre los meses visibles, también los cerrados", async () => {
    renderizar();
    await screen.findByText("Hna. Pérez");
    expect(screen.getByRole("button", { name: "Mes anterior" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
    expect(await screen.findByText("Familia Muñoz")).toBeInTheDocument();
    expect(screen.getByText("Diciembre 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mes siguiente" })).toBeDisabled();
  });

  it("filtra por compañerismo", async () => {
    renderizar();
    await screen.findByText("Hna. Pérez");
    await userEvent.click(screen.getByRole("button", { name: "Hermanas" }));
    expect(screen.queryByText("Hna. Pérez")).not.toBeInTheDocument();
    expect(screen.getByText("Hna. González")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Todos" }));
    expect(screen.getByText("Hna. Pérez")).toBeInTheDocument();
  });

  it("usa el idioma del barrio", async () => {
    simular("pt");
    renderizar();
    expect(await screen.findByText("Para os missionários")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Escrever para Hna. Pérez pelo WhatsApp" })).toBeInTheDocument();
  });

  it("si cambiaron el código, olvida el token y vuelve a pedirlo con un aviso, sin datos", async () => {
    simular("es", { "/api/barrios/centro/misioneros": TOKEN_INVALIDO });
    renderizar();
    expect(await screen.findByText(CODIGO_CAMBIO)).toBeInTheDocument();
    expect(screen.getByLabelText("Código de acceso")).toBeInTheDocument();
    expect(screen.queryByText("Hna. Pérez")).not.toBeInTheDocument();
    expect(localStorage.getItem(CLAVE_TOKEN)).toBeNull();
  });

  it("el aviso del código cambiado también sale en el idioma elegido", async () => {
    localStorage.setItem("almuerzo-misional:idioma", "en");
    simular("es", { "/api/barrios/centro/misioneros": TOKEN_INVALIDO });
    renderizar();
    await waitFor(() =>
      expect(screen.getByText("The code changed. Ask the Relief Society president for the new one.")).toBeInTheDocument(),
    );
  });

  it("Salir olvida el token de este teléfono y vuelve a pedir el código", async () => {
    renderizar();
    await screen.findByText("Hna. Pérez");
    await userEvent.click(screen.getByRole("button", { name: "Salir" }));
    expect(await screen.findByLabelText("Código de acceso")).toBeInTheDocument();
    expect(localStorage.getItem(CLAVE_TOKEN)).toBeNull();
  });

  it("marca el día de hoy", async () => {
    renderizar();
    const hoy = await screen.findByRole("region", { name: /, 5 de noviembre/ });
    expect(within(hoy).getByText("Hoy")).toBeInTheDocument();
  });

  it("si cambian el código con la página abierta, deja de mostrar los datos y avisa", async () => {
    renderizar();
    await screen.findByText("Hna. Pérez");
    simular("es", { "/api/barrios/centro/misioneros": TOKEN_INVALIDO });
    // Volver a la pestaña hace que React Query vuelva a pedir los datos.
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    expect(await screen.findByText(CODIGO_CAMBIO)).toBeInTheDocument();
    expect(screen.queryByText("Hna. Pérez")).not.toBeInTheDocument();
    focusManager.setFocused(undefined);
  });

  describe("con días pasados", () => {
    beforeEach(() => {
      simularApi({
        "/api/barrios/centro/misioneros/meses/2026-11": {
          json: {
            ...noviembre.json,
            turnos: [
              turno("t-02e", "2026-11-02", "c-e", { estado: "tomado", nombre: "Hna. Antigua" }),
              turno("t-03e", "2026-11-03", "c-e"),
              turno("t-03h", "2026-11-03", "c-h", { estado: "tomado", nombre: "Hna. Pasada" }),
              turno("t-06e", "2026-11-06", "c-e", { estado: "tomado", nombre: "Hna. Futura" }),
            ],
          },
        },
        "/api/barrios/centro/misioneros": barrio(),
      });
    });

    it("cuenta solo los días anteriores del compañerismo elegido", async () => {
      renderizar();
      expect(await screen.findByRole("button", { name: "Ver los 2 días anteriores" })).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Hermanas" }));
      expect(screen.getByRole("button", { name: "Ver el día anterior" })).toBeInTheDocument();
    });

    it("avisa cuando no queda nada que mostrar", async () => {
      renderizar();
      await screen.findByText("Hna. Futura");
      await userEvent.click(screen.getByRole("button", { name: "Hermanas" }));
      expect(screen.getByText("No hay almuerzos para mostrar.")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Ver el día anterior" }));
      expect(screen.getByText("Hna. Pasada")).toBeInTheDocument();
      expect(screen.queryByText("No hay almuerzos para mostrar.")).not.toBeInTheDocument();
    });
  });
});
