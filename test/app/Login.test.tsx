import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { RutaAdmin } from "@/app/components/RutaAdmin";
import { useIdioma } from "@/app/i18n";
import { Login } from "@/app/pantallas/Login";
import { Proveedores, simularApi } from "./utilidades";

const YO = {
  usuario: { id: "u-1", email: "presidenta@ejemplo.cl", nombre: "Presidenta", superAdmin: false },
  barrios: [{ slug: "centro", nombre: "Barrio Centro", cargo: null }],
};
const SIN_SESION = { status: 401, json: { error: "NO_AUTORIZADO" } };
const CREDENCIALES_MALAS = { status: 401, json: { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" } };

/** Las mismas rutas de admin que `router.tsx`, en memoria. */
function renderizar(url: string, extra?: React.ReactNode) {
  const router = createMemoryRouter(
    [
      { path: "/admin/login", element: <Login /> },
      {
        path: "/admin",
        element: (
          <RutaAdmin>
            <p>Panel de prueba</p>
          </RutaAdmin>
        ),
      },
    ],
    { initialEntries: [url] },
  );
  return render(
    <Proveedores>
      {extra}
      <RouterProvider router={router} />
    </Proveedores>,
  );
}

async function llenar(user: ReturnType<typeof userEvent.setup>, correo: string, clave: string) {
  await user.type(screen.getByLabelText("Correo electrónico"), correo);
  await user.type(screen.getByLabelText("Contraseña"), clave);
}

describe("Login", () => {
  it("credenciales inválidas muestran el error traducido", async () => {
    const user = userEvent.setup();
    simularApi({ "/api/admin/yo": SIN_SESION, "/api/auth/sign-in/email": CREDENCIALES_MALAS });
    renderizar("/admin/login");

    await llenar(user, "presidenta@ejemplo.cl", "mala");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El correo o la contraseña no son correctos.");
  });

  it("el error sale en el idioma elegido", async () => {
    const user = userEvent.setup();
    simularApi({ "/api/admin/yo": SIN_SESION, "/api/auth/sign-in/email": CREDENCIALES_MALAS });
    function EnIngles() {
      const { cambiarIdioma } = useIdioma();
      return (
        <button type="button" onClick={() => cambiarIdioma("en")}>
          en
        </button>
      );
    }
    renderizar("/admin/login", <EnIngles />);
    await user.click(screen.getByRole("button", { name: "en" }));

    await user.type(await screen.findByLabelText("Email"), "presidenta@ejemplo.cl");
    await user.type(screen.getByLabelText("Password"), "mala");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The email or password is incorrect.");
  });

  it("un error de red muestra el error genérico", async () => {
    const user = userEvent.setup();
    simularApi({ "/api/admin/yo": SIN_SESION, "/api/auth/sign-in/email": { status: 500, json: {} } });
    renderizar("/admin/login");

    await llenar(user, "presidenta@ejemplo.cl", "clave");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Algo salió mal");
  });

  it("un login exitoso lleva a /admin", async () => {
    const user = userEvent.setup();
    let dentro = false;
    simularApi({
      "/api/admin/yo": () => (dentro ? { json: YO } : SIN_SESION),
      "/api/auth/sign-in/email": () => {
        dentro = true;
        return { json: { redirect: false, token: "t", user: { id: "u-1", email: "presidenta@ejemplo.cl" } } };
      },
    });
    renderizar("/admin/login");

    await llenar(user, "presidenta@ejemplo.cl", "presidenta-dev-123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Panel de prueba")).toBeInTheDocument();
  });

  it("con campos vacíos no llama a la API de login", async () => {
    const user = userEvent.setup();
    const fetchMock = simularApi({ "/api/admin/yo": SIN_SESION, "/api/auth/sign-in/email": CREDENCIALES_MALAS });
    renderizar("/admin/login");

    await user.click(await screen.findByRole("button", { name: "Entrar" }));

    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("sign-in"))).toBe(false);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("con sesión abierta, /admin/login redirige a /admin", async () => {
    simularApi({ "/api/admin/yo": { json: YO } });
    renderizar("/admin/login");

    expect(await screen.findByText("Panel de prueba")).toBeInTheDocument();
  });
});

describe("RutaAdmin", () => {
  it("/admin sin sesión termina en el login", async () => {
    simularApi({ "/api/admin/yo": SIN_SESION });
    renderizar("/admin");

    expect(await screen.findByRole("heading", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.queryByText("Panel de prueba")).not.toBeInTheDocument();
  });

  it("/admin con sesión muestra el panel", async () => {
    simularApi({ "/api/admin/yo": { json: YO } });
    renderizar("/admin");

    expect(await screen.findByText("Panel de prueba")).toBeInTheDocument();
  });
});
