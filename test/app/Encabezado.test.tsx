import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Encabezado } from "@/app/components/Encabezado";
import { Proveedores } from "./utilidades";

describe("Encabezado", () => {
  it("cambia de idioma eligiendo en el selector", async () => {
    const user = userEvent.setup();
    render(
      <Proveedores>
        <Encabezado titulo="Noviembre" />
      </Proveedores>,
    );
    expect(screen.getByText("Almuerzo Misional")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Idioma" }));
    await user.click(await screen.findByRole("option", { name: "Português" }));

    expect(await screen.findByText("Almoço Missionário")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Idioma" })).toHaveTextContent("Português");
  });
});
