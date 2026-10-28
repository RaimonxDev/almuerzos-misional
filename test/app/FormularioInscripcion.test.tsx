import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ErrorApi } from "@/app/api";
import { useIdioma } from "@/app/i18n";
import { FormularioInscripcion } from "@/app/components/FormularioInscripcion";
import { Proveedores } from "./utilidades";

/** Botón de prueba para cambiar el idioma sin pasar por el Select de Radix. */
function APortugues() {
  const { cambiarIdioma } = useIdioma();
  return <button onClick={() => cambiarIdioma("pt")}>pt</button>;
}

function renderizar(props: Partial<Parameters<typeof FormularioInscripcion>[0]> = {}) {
  const onEnviar = vi.fn();
  const utils = render(
    <Proveedores>
      <APortugues />
      <FormularioInscripcion
        notaParaCocinar={null}
        textoEnviar="Confirmar mi día"
        enviando={false}
        errorEnvio={null}
        onEnviar={onEnviar}
        {...props}
      />
    </Proveedores>,
  );
  return { ...utils, onEnviar, user: userEvent.setup() };
}

describe("FormularioInscripcion", () => {
  it("envía los valores escritos", async () => {
    const { user, onEnviar } = renderizar();
    await user.type(screen.getByLabelText("¿Quién da el almuerzo?"), "Hna. Pérez");
    await user.type(screen.getByLabelText("Teléfono (WhatsApp)"), "+56 9 1234 5678");
    await user.click(screen.getByLabelText("Les llevo el almuerzo"));
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Confirmar mi día" }));

    expect(onEnviar).toHaveBeenCalledWith({
      nombre: "Hna. Pérez",
      telefono: "+56 9 1234 5678",
      consentimientoTelefono: true,
      modalidad: "llevar",
      nota: "",
    });
  });

  it("vacío: marca el nombre, lleva el foco ahí y no envía", async () => {
    const { user, onEnviar } = renderizar();
    await user.click(screen.getByRole("button", { name: "Confirmar mi día" }));

    const nombre = screen.getByLabelText("¿Quién da el almuerzo?");
    expect(nombre).toHaveAttribute("aria-invalid", "true");
    expect(nombre).toHaveFocus();
    expect(screen.getByText("Escribe tu nombre (al menos 2 letras).")).toBeInTheDocument();
    expect(onEnviar).not.toHaveBeenCalled();
  });

  it("consentimiento sin teléfono pide escribirlo", async () => {
    const { user, onEnviar } = renderizar();
    await user.type(screen.getByLabelText("¿Quién da el almuerzo?"), "Hna. Pérez");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Confirmar mi día" }));

    expect(screen.getByText("Para compartir tu teléfono, escríbelo arriba.")).toBeInTheDocument();
    expect(onEnviar).not.toHaveBeenCalled();
  });

  it("teléfono con letras no pasa", async () => {
    const { user, onEnviar } = renderizar();
    await user.type(screen.getByLabelText("¿Quién da el almuerzo?"), "Hna. Pérez");
    await user.type(screen.getByLabelText("Teléfono (WhatsApp)"), "llámame");
    await user.click(screen.getByRole("button", { name: "Confirmar mi día" }));

    expect(screen.getByLabelText("Teléfono (WhatsApp)")).toHaveAttribute("aria-invalid", "true");
    expect(onEnviar).not.toHaveBeenCalled();
  });

  it("marca los campos que rechaza la API", () => {
    renderizar({ errorEnvio: new ErrorApi("DATOS_INVALIDOS", 400, ["telefono"]) });
    expect(screen.getByLabelText("Teléfono (WhatsApp)")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("muestra otros errores de la API como alerta traducida", () => {
    renderizar({ errorEnvio: new ErrorApi("MES_NO_ABIERTO", 422) });
    expect(screen.getByRole("alert")).toHaveTextContent("Este mes no está abierto para anotarse.");
  });

  it("los errores cambian de idioma junto con la pantalla", async () => {
    const { user } = renderizar();
    await user.click(screen.getByRole("button", { name: "Confirmar mi día" }));
    await user.click(screen.getByRole("button", { name: "pt" }));
    expect(screen.getByText("Escreva seu nome (pelo menos 2 letras).")).toBeInTheDocument();
  });

  it("parte con los valores iniciales (editar en Mi turno)", () => {
    renderizar({
      inicial: { nombre: "Hna. Rojas", telefono: "+56 9 1", consentimientoTelefono: true, modalidad: "en_casa", nota: "13:30" },
    });
    expect(screen.getByLabelText("¿Quién da el almuerzo?")).toHaveValue("Hna. Rojas");
    expect(screen.getByLabelText("Vienen a mi casa")).toBeChecked();
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByLabelText(/Dirección u hora/)).toHaveValue("13:30");
  });
});
