import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderizarApp } from "./utilidades";

describe("portada /", () => {
  it("dice qué es, lleva a solicitar y enlaza las preguntas y la información", async () => {
    renderizarApp("/");
    expect(await screen.findByRole("heading", { level: 1, name: "Almuerzo Misional" })).toBeInTheDocument();
    expect(screen.getByText(/El calendario de almuerzos para los misioneros/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Solicitar para mi barrio" })).toHaveAttribute("href", "/solicitar");
    expect(screen.getByRole("link", { name: "Ver todas las preguntas" })).toHaveAttribute("href", "/preguntas");
    expect(screen.getByRole("link", { name: "Información y aviso legal" })).toHaveAttribute("href", "/informacion");
    expect(screen.getByRole("link", { name: "Entrar al panel de administración" })).toHaveAttribute("href", "/admin/login");
    expect(screen.getByRole("link", { name: "hi@ramonmartinez.dev" })).toHaveAttribute("href", "mailto:hi@ramonmartinez.dev");
    expect(screen.getByRole("heading", { name: "Buen provecho, élderes y hermanas" })).toBeInTheDocument();

    // Las pestañas de las carpetas llevan a cada sección de la página.
    const secciones = screen.getByRole("navigation", { name: "Secciones" });
    for (const [nombre, id] of [
      ["Cómo funciona", "como-funciona"],
      ["Lo que cambia", "lo-que-cambia"],
      ["Preguntas", "preguntas"],
      ["Solicitar", "solicitar"],
    ]) {
      expect(within(secciones).getByRole("link", { name: nombre })).toHaveAttribute("href", `#${id}`);
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it("la semana de prueba deja anotarse en un turno libre y deshacerlo", async () => {
    const user = userEvent.setup();
    renderizarApp("/");
    expect(await screen.findByText("Quedan 6 turnos libres")).toBeInTheDocument();

    const libres = screen.getAllByRole("button", { name: /^Anotarme: / });
    expect(libres).toHaveLength(6);
    await user.click(libres[0]);
    await user.type(screen.getByRole("textbox", { name: /^Tu nombre/ }), "Hna. Prueba");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(screen.getByText("Hna. Prueba")).toBeInTheDocument();
    expect(screen.getByText("Quedan 5 turnos libres")).toBeInTheDocument();
    expect(screen.getByText(/es tuyo/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(screen.queryByText("Hna. Prueba")).not.toBeInTheDocument();
    expect(screen.getByText("Quedan 6 turnos libres")).toBeInTheDocument();
  });

  it("un nombre de menos de 2 letras no confirma", async () => {
    const user = userEvent.setup();
    renderizarApp("/");
    await user.click((await screen.findAllByRole("button", { name: /^Anotarme: / }))[0]);
    await user.type(screen.getByRole("textbox", { name: /^Tu nombre/ }), "A");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(screen.getByText("Quedan 6 turnos libres")).toBeInTheDocument();
  });

  it("cambia de idioma con el selector", async () => {
    const user = userEvent.setup();
    renderizarApp("/");
    await screen.findByRole("heading", { level: 1, name: "Almuerzo Misional" });
    await user.click(screen.getByRole("combobox", { name: "Idioma" }));
    await user.click(await screen.findByRole("option", { name: "Português" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Almoço Missionário" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Solicitar para minha ala" })).toHaveAttribute("href", "/solicitar");
    expect(screen.getByText("Restam 6 turnos livres")).toBeInTheDocument();
  });
});

describe("/preguntas", () => {
  it("muestra todas las preguntas con su respuesta, agrupadas, y enlaza la información", async () => {
    renderizarApp("/preguntas");
    expect(await screen.findByRole("heading", { level: 1, name: "Preguntas frecuentes" })).toBeInTheDocument();
    for (const grupo of ["Para las hermanas", "Para la presidenta", "Para los misioneros", "Sobre el sitio"]) {
      expect(screen.getByRole("heading", { level: 2, name: grupo })).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { level: 3, name: "¿Quién ve mi teléfono?" })).toBeInTheDocument();
    expect(screen.getByText(/ven tu teléfono solo si marcas la casilla/)).toBeInTheDocument();
    // Cada pregunta tiene su ancla para enlazarla.
    expect(document.getElementById("telefono")).not.toBeNull();
    // La introducción y el pie llevan el correo de contacto.
    for (const correo of screen.getAllByRole("link", { name: "hi@ramonmartinez.dev" })) {
      expect(correo).toHaveAttribute("href", "mailto:hi@ramonmartinez.dev");
    }
    expect(screen.getAllByRole("link", { name: "hi@ramonmartinez.dev" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Información y aviso legal" })[0]).toHaveAttribute("href", "/informacion");
  });
});
