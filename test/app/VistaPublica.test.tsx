import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const ELDERES = { id: "c-e", nombre: "Élderes", tipo: "elderes" };
const HERMANAS = { id: "c-h", nombre: "Hermanas", tipo: "hermanas" };

function simularMes({ estado = "abierto", companerismos = [ELDERES, HERMANAS] } = {}) {
  simularApi({
    "/api/barrios/centro/meses/2026-11": {
      json: {
        mes: { anio: 2026, mes: 11, estado },
        companerismos,
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
}

beforeEach(() => {
  simularMes();
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

describe("VistaPublica en calendario", () => {
  const verCalendario = async () => {
    await userEvent.click(await screen.findByRole("button", { name: "Calendario" }));
  };
  const celda = (nombre: string | RegExp) => screen.getByRole("button", { name: nombre });

  it("por defecto muestra la lista; 'Calendario' muestra una celda por día, desde el domingo", async () => {
    renderizar();
    expect(await screen.findByRole("button", { name: "Lista" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryAllByRole("button", { name: /de noviembre/ })).toHaveLength(0);

    await verCalendario();
    expect(screen.getByRole("button", { name: "Calendario" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("button", { name: /de noviembre/ })).toHaveLength(30);
    const cabecera = screen.getAllByText(/^(dom|lun|mar|mié|jue|vie|sáb)$/).map((c) => c.textContent);
    expect(cabecera).toEqual(["dom", "lun", "mar", "mié", "jue", "vie", "sáb"]);
  });

  it("recuerda la elección al volver a montar la pantalla", async () => {
    const { unmount } = renderizar();
    await verCalendario();
    unmount();
    renderizar();
    expect(await screen.findByRole("button", { name: "Calendario" })).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findAllByRole("button", { name: /de noviembre/ })).toHaveLength(30);
  });

  it("cada celda anuncia la fecha, si es hoy, si tienes un turno y los turnos libres", async () => {
    renderizar();
    await verCalendario();
    expect(celda("martes, 10 de noviembre, 1 turno libre")).toBeInTheDocument();
    expect(celda("jueves, 5 de noviembre, hoy, sin turnos libres")).toHaveAttribute("aria-pressed", "true");
    expect(celda("lunes, 9 de noviembre, tienes un turno, sin turnos libres")).toBeInTheDocument();
    expect(celda("domingo, 15 de noviembre, bloqueado")).toBeInTheDocument();
    // Un turno libre de un día pasado ya no se puede tomar.
    expect(celda("martes, 3 de noviembre, sin turnos libres")).toBeInTheDocument();
  });

  it("tocar un día muestra sus turnos: nombres de los tomados y 'Anotarme' solo de hoy en adelante", async () => {
    renderizar();
    await verCalendario();

    await userEvent.click(celda(/^lunes, 9 de noviembre/));
    expect(celda(/^lunes, 9 de noviembre/)).toHaveAttribute("aria-pressed", "true");
    const dia9 = screen.getByRole("region", { name: "lunes, 9 de noviembre" });
    expect(dia9).toHaveTextContent("Hna. Mía");
    expect(dia9).toHaveTextContent("Hna. Otra");
    expect(within(dia9).getByRole("link", { name: "Ver mi turno" })).toHaveAttribute("href", "/centro/mi-turno/i-mia");
    expect(within(dia9).queryByRole("link", { name: "Anotarme" })).not.toBeInTheDocument();

    await userEvent.click(celda(/^martes, 10 de noviembre/));
    const dia10 = screen.getByRole("region", { name: "martes, 10 de noviembre" });
    expect(within(dia10).getByRole("link", { name: "Anotarme" })).toHaveAttribute("href", "/centro/anotarse/t-10");

    await userEvent.click(celda(/^martes, 3 de noviembre/));
    const dia3 = screen.getByRole("region", { name: "martes, 3 de noviembre" });
    expect(dia3).toHaveTextContent("Disponible");
    expect(within(dia3).queryByRole("link", { name: "Anotarme" })).not.toBeInTheDocument();
  });

  it("en un mes cerrado no hay 'Anotarme'", async () => {
    simularMes({ estado: "cerrado" });
    renderizar();
    await verCalendario();
    await userEvent.click(celda(/^martes, 10 de noviembre/));
    expect(screen.getByRole("region", { name: "martes, 10 de noviembre" })).toHaveTextContent("Disponible");
    expect(screen.queryByRole("link", { name: "Anotarme" })).not.toBeInTheDocument();
  });

  it("con dos compañerismos los chips llevan su inicial y la leyenda las explica", async () => {
    renderizar();
    await verCalendario();
    expect(celda(/^lunes, 9 de noviembre/)).toHaveTextContent(/^9EH$/);
    const leyenda = screen.getByRole("list", { name: "Leyenda" });
    expect(leyenda).toHaveTextContent("Tuyo");
    expect(leyenda).toHaveTextContent("E Élderes · H Hermanas");
  });

  it("con un solo compañerismo los chips no llevan inicial", async () => {
    simularMes({ companerismos: [ELDERES] });
    renderizar();
    await verCalendario();
    expect(celda(/^martes, 10 de noviembre/)).toHaveTextContent(/^10$/);
    expect(screen.getByRole("list", { name: "Leyenda" })).not.toHaveTextContent("Élderes");
  });

  it("si dos compañerismos empiezan con la misma letra, sus chips se distinguen", async () => {
    simularMes({
      companerismos: [
        { id: "c-e", nombre: "Élderes Norte", tipo: "elderes" },
        { id: "c-h", nombre: "Élderes Sur", tipo: "elderes" },
      ],
    });
    renderizar();
    await verCalendario();
    expect(celda(/^lunes, 9 de noviembre/)).toHaveTextContent(/^9ENES$/);
    expect(screen.getByRole("list", { name: "Leyenda" })).toHaveTextContent("EN Élderes Norte · ES Élderes Sur");
  });

  it("con 'Solo libres' se atenúan también los días sin turnos", async () => {
    renderizar();
    await verCalendario();
    await userEvent.click(screen.getByRole("button", { name: "Solo libres" }));
    expect(celda(/^viernes, 6 de noviembre/)).toHaveClass("opacity-45");
    expect(celda(/^martes, 10 de noviembre/)).not.toHaveClass("opacity-45");
  });
});
