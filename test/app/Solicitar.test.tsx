import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Solicitar } from "@/app/pantallas/Solicitar";
import { renderizarApp, renderizarRuta, simularApi } from "./utilidades";

vi.mock("@/app/components/Turnstile", async () => {
  const { useEffect } = await import("react");
  return {
    Turnstile: ({ onToken }: { onToken: (t: string) => void }) => {
      useEffect(() => onToken("token-de-prueba"), [onToken]);
      return <div data-testid="turnstile" />;
    },
  };
});

function renderizar() {
  renderizarRuta("/solicitar", "/solicitar", <Solicitar />);
  return userEvent.setup();
}

async function llenar(user: ReturnType<typeof userEvent.setup>, email = "ana@ejemplo.cl") {
  await user.type(screen.getByLabelText("Tu nombre"), "Ana Soto");
  await user.type(screen.getByLabelText("Correo"), email);
  await user.type(screen.getByLabelText("Teléfono"), "+56 9 1234 5678");
  await user.type(screen.getByLabelText("Barrio"), "Barrio Centro");
  await user.type(screen.getByLabelText("Ciudad"), "Santiago");
  await user.type(screen.getByLabelText("País"), "Chile");
}

describe("Solicitar acceso", () => {
  it("llenar y enviar manda los datos y muestra el éxito", async () => {
    const mock = simularApi({ "/api/solicitudes": { status: 201, json: { id: "s1" } } });
    const user = renderizar();
    await llenar(user);
    await user.click(screen.getByRole("checkbox", { name: "Élderes" }));
    await user.click(screen.getByRole("button", { name: "Enviar solicitud" }));

    expect(await screen.findByText("Recibimos tu solicitud")).toBeInTheDocument();
    const cuerpo = JSON.parse(String(mock.mock.calls[0][1]?.body));
    expect(cuerpo).toMatchObject({
      nombre: "Ana Soto",
      email: "ana@ejemplo.cl",
      barrio: "Barrio Centro",
      ciudad: "Santiago",
      pais: "Chile",
      idioma: "es",
      companerismos: ["elderes"],
      turnstileToken: "token-de-prueba",
    });
    expect(typeof cuerpo.zonaHoraria).toBe("string");
  });

  it("el idioma del barrio sigue al de la pantalla hasta que se elige uno", async () => {
    const user = renderizar();
    const grupo = () => screen.getByRole("group", { name: "Idioma del barrio" });
    expect(within(grupo()).getByRole("button", { name: "Español" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("combobox", { name: "Idioma" }));
    await user.click(await screen.findByRole("option", { name: "Português" }));
    const grupoPt = screen.getByRole("group", { name: "Idioma da ala" });
    expect(within(grupoPt).getByRole("button", { name: "Português" })).toHaveAttribute("aria-pressed", "true");
  });

  it("sin elegir misioneros no se envía y marca el campo", async () => {
    const mock = simularApi({ "/api/solicitudes": { status: 201, json: { id: "s1" } } });
    const user = renderizar();
    await llenar(user);
    await user.click(screen.getByRole("button", { name: "Enviar solicitud" }));
    expect(await screen.findByText("Elige al menos un tipo de misioneros.")).toBeInTheDocument();
    expect(mock).not.toHaveBeenCalled();
  });

  it("con un correo inválido no se envía y marca el campo", async () => {
    const mock = simularApi({ "/api/solicitudes": { status: 201, json: { id: "s1" } } });
    const user = renderizar();
    await llenar(user, "no-es-correo");
    await user.click(screen.getByRole("checkbox", { name: "Hermanas" }));
    await user.click(screen.getByRole("button", { name: "Enviar solicitud" }));
    expect(await screen.findByText("Revisa el correo.")).toBeInTheDocument();
    expect(mock).not.toHaveBeenCalled();
  });

  it("un 409 muestra el mensaje de solicitud pendiente", async () => {
    simularApi({ "/api/solicitudes": { status: 409, json: { error: "SOLICITUD_PENDIENTE" } } });
    const user = renderizar();
    await llenar(user);
    await user.click(screen.getByRole("checkbox", { name: "Élderes" }));
    await user.click(screen.getByRole("button", { name: "Enviar solicitud" }));
    expect(await screen.findByText(/Ya recibimos una solicitud con ese correo/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Recibimos tu solicitud")).not.toBeInTheDocument());
  });

  it("la portada enlaza a /solicitar y la ruta carga la pantalla", async () => {
    renderizarApp("/");
    const enlace = await screen.findByRole("link", { name: "Solicitar acceso" });
    expect(enlace).toHaveAttribute("href", "/solicitar");
    await userEvent.setup().click(enlace);
    expect(await screen.findByLabelText("Tu nombre")).toBeInTheDocument();
  });
});
