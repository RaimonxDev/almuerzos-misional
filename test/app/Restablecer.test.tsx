import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { rutas } from "@/app/router";
import { Proveedores, simularApi } from "./utilidades";

const SIN_SESION = { status: 401, json: { error: "NO_AUTORIZADO" } };
const TOKEN = "tokenSecreto1234567890ab";

/** Las rutas reales, devolviendo también el router para mirar la URL. */
function renderizar(url: string) {
  const router = createMemoryRouter(rutas, { initialEntries: [url] });
  render(
    <Proveedores>
      <RouterProvider router={router} />
    </Proveedores>,
  );
  return router;
}

const cuerposA = (api: ReturnType<typeof simularApi>, ruta: string) =>
  api.mock.calls
    .filter(([entrada]) => String(entrada instanceof Request ? entrada.url : entrada).includes(ruta))
    .map(([, init]) => JSON.parse(String(init?.body)));

async function elegir(user: ReturnType<typeof userEvent.setup>, nueva: string, repetida = nueva) {
  await user.type(await screen.findByLabelText("Contraseña nueva"), nueva);
  await user.type(screen.getByLabelText("Repite la contraseña nueva"), repetida);
  await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));
}

describe("login", () => {
  it("enlaza a /admin/olvide", async () => {
    simularApi({ "/api/admin/yo": SIN_SESION });
    renderizar("/admin/login");
    expect(await screen.findByRole("link", { name: "¿Olvidaste tu contraseña?" })).toHaveAttribute(
      "href",
      "/admin/olvide",
    );
  });
});

describe("/admin/olvide", () => {
  it("pide el enlace y responde siempre lo mismo", async () => {
    const user = userEvent.setup();
    const api = simularApi({ "/api/auth/request-password-reset": { json: { status: true, message: "x" } } });
    renderizar("/admin/olvide");

    await user.type(await screen.findByLabelText("Correo electrónico"), " a@ejemplo.cl ");
    await user.click(screen.getByRole("button", { name: "Enviar enlace" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Si existe una cuenta con ese correo");
    expect(cuerposA(api, "/api/auth/request-password-reset")).toEqual([{ email: "a@ejemplo.cl" }]);
    expect(screen.getByRole("link", { name: "Volver a entrar" })).toHaveAttribute("href", "/admin/login");
  });

  it("demasiados intentos (429) muestran su mensaje", async () => {
    const user = userEvent.setup();
    simularApi({ "/api/auth/request-password-reset": { status: 429, json: { message: "Too many requests" } } });
    renderizar("/admin/olvide");

    await user.type(await screen.findByLabelText("Correo electrónico"), "a@ejemplo.cl");
    await user.click(screen.getByRole("button", { name: "Enviar enlace" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Demasiados intentos.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("/admin/restablecer", () => {
  it("saca el token de la URL, del título y del referer", async () => {
    simularApi({});
    const router = renderizar(`/admin/restablecer?token=${TOKEN}`);

    expect(await screen.findByLabelText("Contraseña nueva")).toBeInTheDocument();
    // El formulario aparece antes de que termine la navegación que saca el token.
    await waitFor(() => expect(router.state.location.search).toBe(""));
    expect(router.state.location.pathname).toBe("/admin/restablecer");
    expect(document.title).not.toContain(TOKEN);
    expect(document.querySelector('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
  });

  it("con el token guarda la contraseña nueva y enlaza al login", async () => {
    const user = userEvent.setup();
    const api = simularApi({ "/api/auth/reset-password": { json: { status: true } } });
    renderizar(`/admin/restablecer?token=${TOKEN}`);

    await elegir(user, "mi-clave-nueva-1");

    expect(await screen.findByRole("status")).toHaveTextContent("Tu contraseña cambió");
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/admin/login");
    expect(cuerposA(api, "/api/auth/reset-password")).toEqual([{ newPassword: "mi-clave-nueva-1", token: TOKEN }]);
  });

  it("recargar la pantalla (sin el token en la URL) no pierde el token; al terminar se olvida", async () => {
    const user = userEvent.setup();
    const api = simularApi({ "/api/auth/reset-password": { json: { status: true } } });
    renderizar(`/admin/restablecer?token=${TOKEN}`);
    expect(await screen.findByLabelText("Contraseña nueva")).toBeInTheDocument();

    // Como un F5, o el móvil que descarta la pestaña: la URL ya no trae el token.
    cleanup();
    renderizar("/admin/restablecer");
    await elegir(user, "mi-clave-nueva-1");
    expect(await screen.findByRole("status")).toHaveTextContent("Tu contraseña cambió");
    expect(cuerposA(api, "/api/auth/reset-password")).toEqual([{ newPassword: "mi-clave-nueva-1", token: TOKEN }]);

    cleanup();
    renderizar("/admin/restablecer");
    expect(await screen.findByRole("link", { name: "Pedir otro enlace" })).toBeInTheDocument();
  });

  it("valida largo y repetición antes de llamar a la API", async () => {
    const user = userEvent.setup();
    const api = simularApi({ "/api/auth/reset-password": { json: { status: true } } });
    renderizar(`/admin/restablecer?token=${TOKEN}`);

    await elegir(user, "corta-12");
    expect(await screen.findByRole("alert")).toHaveTextContent("al menos 10 caracteres");
    await user.clear(screen.getByLabelText("Contraseña nueva"));
    await user.clear(screen.getByLabelText("Repite la contraseña nueva"));
    await elegir(user, "mi-clave-nueva-1", "mi-clave-nueva-2");
    expect(await screen.findByRole("alert")).toHaveTextContent("no coinciden");
    expect(cuerposA(api, "/api/auth/reset-password")).toEqual([]);
  });

  it("un token vencido o usado muestra el mensaje y el enlace para pedir otro", async () => {
    const user = userEvent.setup();
    simularApi({ "/api/auth/reset-password": { status: 400, json: { code: "INVALID_TOKEN", message: "Invalid token" } } });
    renderizar(`/admin/restablecer?token=${TOKEN}`);

    await elegir(user, "mi-clave-nueva-1");

    expect(await screen.findByText("Este enlace venció o ya se usó.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pedir otro enlace" })).toHaveAttribute("href", "/admin/olvide");
    expect(screen.queryByLabelText("Contraseña nueva")).not.toBeInTheDocument();
  });

  it("sin token muestra directo el enlace para pedir otro", async () => {
    simularApi({});
    renderizar("/admin/restablecer");
    expect(await screen.findByRole("link", { name: "Pedir otro enlace" })).toHaveAttribute("href", "/admin/olvide");
  });
});
