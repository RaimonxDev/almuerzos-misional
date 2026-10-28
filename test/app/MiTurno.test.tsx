import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { MiTurnoRuta } from "@/app/pantallas/MiTurno";
import { guardarInscripciones, renderizarRuta, simularApi } from "./utilidades";

beforeEach(() => {
  simularApi({
    "/api/inscripciones/i-1": {
      json: {
        inscripcion: {
          id: "i-1",
          turnoId: "t-1",
          fecha: "2099-11-10",
          companerismoNombre: "Élderes",
          barrio: { slug: "centro", nombre: "Barrio Centro" },
          nombre: "Hna. Pérez",
          telefono: "+56 9 1234 5678",
          consentimientoTelefono: true,
          modalidad: "en_casa",
          nota: null,
          editable: true,
        },
      },
    },
    "/api/barrios/centro": {
      json: {
        barrio: { slug: "centro", nombre: "Barrio Centro", idioma: "es", zonaHoraria: "America/Santiago", notaParaCocinar: null },
        mesesAbiertos: [{ anio: 2099, mes: 11 }],
        hoy: "2099-11-01",
      },
    },
  });
  guardarInscripciones([
    { id: "i-1", turnoId: "t-1", barrio: "centro", fecha: "2099-11-10", companerismo: "Élderes", tokenEdicion: "tok" },
  ]);
});

const renderizar = () =>
  renderizarRuta("/:barrio/mi-turno/:inscripcionId", "/centro/mi-turno/i-1", <MiTurnoRuta />);

describe("MiTurno", () => {
  it("el diálogo de cancelar abre, se cierra con Escape y devuelve el foco al botón", async () => {
    const user = userEvent.setup();
    renderizar();
    const cancelar = await screen.findByRole("button", { name: "Cancelar mi turno" });

    await user.click(cancelar);
    const dialogo = await screen.findByRole("dialog", { name: "¿Cancelar tu turno?" });
    expect(dialogo).toHaveTextContent("quedará libre para que otra persona se anote");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(cancelar).toHaveFocus();
  });

  it("'No, mantenerlo' cierra el diálogo sin cancelar", async () => {
    const user = userEvent.setup();
    renderizar();
    await user.click(await screen.findByRole("button", { name: "Cancelar mi turno" }));
    await user.click(await screen.findByRole("button", { name: "No, mantenerlo" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Hna. Pérez")).toBeInTheDocument();
  });
});
