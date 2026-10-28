import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { VistaPublica } from "@/app/pantallas/VistaPublica";
import { guardarInscripciones, renderizarRuta, simularApi } from "./utilidades";

const HOY = "2026-11-05";

const turno = (id: string, fecha: string, companerismoId: string, extra: object = {}) => ({
  id,
  fecha,
  companerismoId,
  estado: "libre",
  nombre: null,
  inscripcionId: null,
  motivoBloqueo: null,
  ...extra,
});

beforeEach(() => {
  simularApi({
    "/api/barrios/centro/meses/2026-11": {
      json: {
        mes: { anio: 2026, mes: 11, estado: "abierto" },
        companerismos: [
          { id: "c-e", nombre: "Élderes", tipo: "elderes" },
          { id: "c-h", nombre: "Hermanas", tipo: "hermanas" },
        ],
        turnos: [
          turno("t-03", "2026-11-03", "c-e"),
          turno("t-09e", "2026-11-09", "c-e", { estado: "tomado", nombre: "Hna. Mía", inscripcionId: "i-mia" }),
          turno("t-09h", "2026-11-09", "c-h", { estado: "tomado", nombre: "Hna. Otra", inscripcionId: "i-otra" }),
          turno("t-10", "2026-11-10", "c-e"),
          turno("t-15", "2026-11-15", "c-e", { estado: "bloqueado", motivoBloqueo: "Conferencia de estaca" }),
        ],
        hoy: HOY,
      },
    },
    "/api/barrios/centro": {
      json: {
        barrio: { slug: "centro", nombre: "Barrio Centro", idioma: "es", zonaHoraria: "America/Santiago", notaParaCocinar: null },
        mesesAbiertos: [{ anio: 2026, mes: 11 }],
        hoy: HOY,
      },
    },
  });
  guardarInscripciones([
    { id: "i-mia", turnoId: "t-09e", barrio: "centro", fecha: "2026-11-09", companerismo: "Élderes", tokenEdicion: "a" },
    // La presidenta borró esta y otra hermana tomó el turno: ya no es mía.
    { id: "i-vieja", turnoId: "t-09h", barrio: "centro", fecha: "2026-11-09", companerismo: "Hermanas", tokenEdicion: "b" },
  ]);
});

const renderizar = () => renderizarRuta("/:barrio", "/centro", <VistaPublica />);

describe("VistaPublica", () => {
  it("muestra el barrio y el mes que corresponde a hoy", async () => {
    renderizar();
    expect(await screen.findByRole("heading", { name: "Barrio Centro" })).toBeInTheDocument();
    expect(await screen.findByText("Noviembre 2026")).toBeInTheDocument();
  });

  it("'Ver mi turno' solo donde la inscripción actual es la guardada", async () => {
    renderizar();
    const links = await screen.findAllByRole("link", { name: "Ver mi turno" });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/centro/mi-turno/i-mia");
  });

  it("'Anotarme' solo en turnos libres de hoy en adelante; los días pasados quedan ocultos", async () => {
    renderizar();
    const anotarme = await screen.findAllByRole("link", { name: "Anotarme" });
    expect(anotarme.map((a) => a.getAttribute("href"))).toEqual(["/centro/anotarse/t-10"]);
    expect(screen.getByText("1 turno libre")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver el día anterior" })).toBeInTheDocument();
  });

  it("muestra el motivo de un día bloqueado y nunca el nombre bajo el bloqueo", async () => {
    renderizar();
    expect(await screen.findByText("Conferencia de estaca")).toBeInTheDocument();
  });

  it("lista 'Tus próximos turnos' con fecha y compañerismo", async () => {
    renderizar();
    const tarjeta = await screen.findByRole("navigation", { name: "Tus próximos turnos" });
    expect(within(tarjeta).getAllByRole("link")).toHaveLength(2);
    expect(tarjeta).toHaveTextContent("lunes, 9 de noviembre · Élderes") // la mayúscula la pone CSS;
  });

  it("si el barrio no existe, muestra el error traducido", async () => {
    simularApi({ "/api/barrios/nada": { status: 404, json: { error: "NO_ENCONTRADO" } } });
    renderizarRuta("/:barrio", "/nada", <VistaPublica />);
    expect(await screen.findByText("No encontramos lo que buscas. Revisa el enlace.")).toBeInTheDocument();
  });
});
