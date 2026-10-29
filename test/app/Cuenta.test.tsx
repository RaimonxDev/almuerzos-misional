import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderizarApp, simularApi } from "./utilidades";

/** Sin barrios: el panel muestra un aviso y no necesita más respuestas simuladas. */
const yo = (debeCambiarPassword: boolean) => ({
  usuario: { id: "u-1", email: "nueva@ejemplo.cl", nombre: "Hna. Rojas", superAdmin: false, debeCambiarPassword },
  barrios: [],
});
const SIN_BARRIOS = "Tu cuenta todavía no administra ningún barrio. Pide al administrador que te asigne uno.";

const llamadasCambio = (api: ReturnType<typeof simularApi>) =>
  api.mock.calls
    .filter(([entrada]) => String(entrada instanceof Request ? entrada.url : entrada).includes("/api/auth/change-password"))
    .map(([entrada, init]) => {
      const cuerpo = init?.body ?? (entrada instanceof Request ? null : undefined);
      return cuerpo ? JSON.parse(String(cuerpo)) : undefined;
    });

async function llenar(user: ReturnType<typeof userEvent.setup>, actual: string, nueva: string, repetida = nueva) {
  await user.type(await screen.findByLabelText("Contraseña actual"), actual);
  await user.type(screen.getByLabelText("Contraseña nueva"), nueva);
  await user.type(screen.getByLabelText("Repite la contraseña nueva"), repetida);
  await user.click(screen.getByRole("button", { name: "Cambiar contraseña" }));
}

describe("primer ingreso con contraseña temporal", () => {
  it("con debeCambiarPassword el panel redirige a /admin/cuenta", async () => {
    simularApi({ "/api/admin/yo": { json: yo(true) } });
    renderizarApp("/admin/centro");
    expect(await screen.findByRole("heading", { level: 1, name: "Mi cuenta" })).toBeInTheDocument();
    expect(screen.getByText(/Entraste con una contraseña temporal/)).toBeInTheDocument();
    expect(screen.queryByText(SIN_BARRIOS)).not.toBeInTheDocument();
  });

  it("al cambiarla, refresca la sesión y vuelve al panel", async () => {
    const user = userEvent.setup();
    let cambiada = false;
    const api = simularApi({
      "/api/admin/yo": () => ({ json: yo(!cambiada) }),
      "/api/auth/change-password": () => {
        cambiada = true;
        return { json: { token: "t", user: { id: "u-1" } } };
      },
    });
    renderizarApp("/admin");
    await llenar(user, "k7mp-x3qa-9tdw", "mi-clave-nueva-1");

    expect(await screen.findByText(SIN_BARRIOS)).toBeInTheDocument();
    expect(llamadasCambio(api)).toEqual([
      { currentPassword: "k7mp-x3qa-9tdw", newPassword: "mi-clave-nueva-1", revokeOtherSessions: true },
    ]);
  });
});

describe("/admin/cuenta", () => {
  it("sin obligación se puede abrir y no redirige", async () => {
    simularApi({ "/api/admin/yo": { json: yo(false) } });
    renderizarApp("/admin/cuenta");
    expect(await screen.findByRole("heading", { level: 1, name: "Mi cuenta" })).toBeInTheDocument();
    expect(screen.queryByText(/Entraste con una contraseña temporal/)).not.toBeInTheDocument();
  });

  it("el encabezado del panel enlaza a Mi cuenta", async () => {
    simularApi({ "/api/admin/yo": { json: yo(false) } });
    renderizarApp("/admin");
    expect(await screen.findByRole("link", { name: "Mi cuenta" })).toHaveAttribute("href", "/admin/cuenta");
  });

  it("valida el largo antes de llamar a la API", async () => {
    const user = userEvent.setup();
    const api = simularApi({ "/api/admin/yo": { json: yo(false) }, "/api/auth/change-password": { json: {} } });
    renderizarApp("/admin/cuenta");
    await llenar(user, "clave-actual-123", "corta-12");

    expect(await screen.findByRole("alert")).toHaveTextContent("La contraseña nueva debe tener al menos 10 caracteres.");
    expect(llamadasCambio(api)).toEqual([]);
  });

  it("valida que coincidan antes de llamar a la API", async () => {
    const user = userEvent.setup();
    const api = simularApi({ "/api/admin/yo": { json: yo(false) }, "/api/auth/change-password": { json: {} } });
    renderizarApp("/admin/cuenta");
    await llenar(user, "clave-actual-123", "mi-clave-nueva-1", "mi-clave-nueva-2");

    expect(await screen.findByRole("alert")).toHaveTextContent("Las contraseñas nuevas no coinciden.");
    expect(llamadasCambio(api)).toEqual([]);
  });

  it("la contraseña actual incorrecta muestra el error traducido", async () => {
    const user = userEvent.setup();
    simularApi({
      "/api/admin/yo": { json: yo(false) },
      "/api/auth/change-password": { status: 400, json: { code: "INVALID_PASSWORD", message: "Invalid password" } },
    });
    renderizarApp("/admin/cuenta");
    await llenar(user, "no-es-la-actual", "mi-clave-nueva-1");

    expect(await screen.findByRole("alert")).toHaveTextContent("La contraseña actual no es correcta.");
  });

  it("sin obligación, al cambiarla se queda y avisa", async () => {
    const user = userEvent.setup();
    simularApi({
      "/api/admin/yo": { json: yo(false) },
      "/api/auth/change-password": { json: { token: "t", user: { id: "u-1" } } },
    });
    renderizarApp("/admin/cuenta");
    await llenar(user, "clave-actual-123", "mi-clave-nueva-1");

    expect(await screen.findByRole("status")).toHaveTextContent("Tu contraseña cambió.");
    expect(screen.getByLabelText("Contraseña actual")).toHaveValue("");
  });
});
