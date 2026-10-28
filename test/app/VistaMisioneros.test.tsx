import { act, screen, waitFor, within } from "@testing-library/react";
import { focusManager } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { VistaMisioneros } from "@/app/pantallas/VistaMisioneros";
import { renderizarRuta, simularApi } from "./utilidades";

const HOY = "2026-11-05";
const TOKEN = "token-secreto-de-misioneros";

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

let api: ReturnType<typeof simularApi>;
const simular = (idioma = "es") => {
  api = simularApi({
    "/api/barrios/centro/misioneros/meses/2026-11": noviembre,
    "/api/barrios/centro/misioneros/meses/2026-12": diciembre,
    "/api/barrios/centro/misioneros": barrio(idioma),
  });
};

beforeEach(() => simular());

const renderizar = (url = `/centro/m/${TOKEN}`) => renderizarRuta("/:barrio/m/:token", url, <VistaMisioneros />);

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

  it("con un token inválido muestra un mensaje claro, traducido y sin datos", async () => {
    simularApi({ "/api/barrios/centro/misioneros": { status: 404, json: { error: "TOKEN_INVALIDO" } } });
    renderizar("/centro/m/token-viejo");
    expect(
      await screen.findByText("Este enlace ya no sirve. Pide el enlace nuevo a la presidenta de la Sociedad de Socorro."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Barrio Centro")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  });

  it("el mensaje de token inválido también sale en el idioma elegido", async () => {
    localStorage.setItem("almuerzo-misional:idioma", "en");
    simularApi({ "/api/barrios/centro/misioneros": { status: 404, json: { error: "TOKEN_INVALIDO" } } });
    renderizar("/centro/m/token-viejo");
    await waitFor(() =>
      expect(screen.getByText("This link no longer works. Ask the Relief Society president for the new link.")).toBeInTheDocument(),
    );
  });

  it("marca el día de hoy", async () => {
    renderizar();
    const hoy = await screen.findByRole("region", { name: /, 5 de noviembre/ });
    expect(within(hoy).getByText("Hoy")).toBeInTheDocument();
  });

  it("si regeneran el enlace con la página abierta, deja de mostrar los datos y avisa", async () => {
    renderizar();
    await screen.findByText("Hna. Pérez");
    simularApi({ "/api/barrios/centro/misioneros": { status: 404, json: { error: "TOKEN_INVALIDO" } } });
    // Volver a la pestaña hace que React Query vuelva a pedir los datos.
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    expect(
      await screen.findByText("Este enlace ya no sirve. Pide el enlace nuevo a la presidenta de la Sociedad de Socorro."),
    ).toBeInTheDocument();
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
