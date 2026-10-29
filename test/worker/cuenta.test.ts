import { beforeEach, describe, expect, it } from "vitest";
import { PASSWORD_PRUEBA, crearAdmin, iniciarSesion, pedir, sembrar } from "./datos";

beforeEach(async () => {
  await sembrar();
});

const BARRIO_NUEVO = {
  slug: "oriente",
  nombre: "Barrio Oriente",
  companerismos: [{ tipo: "elderes", nombre: "Élderes" }],
};

/** El super admin crea un barrio con una presidenta nueva; devuelve su contraseña temporal. */
async function presidentaConTemporal(email = "nueva@ejemplo.cl") {
  await crearAdmin({ email: "root@ejemplo.cl", superAdmin: true });
  const root = await iniciarSesion("root@ejemplo.cl");
  const res = await pedir("/api/admin/barrios", {
    method: "POST",
    cookie: root,
    json: { ...BARRIO_NUEVO, presidenta: { email, nombre: "Hna. Rojas" } },
  });
  expect(res.status).toBe(201);
  return (await res.json<any>()).presidenta.passwordTemporal as string;
}

const yo = async (cookie: string) => (await pedir("/api/admin/yo", { cookie })).json<any>();

const cambiar = (cookie: string, currentPassword: string, newPassword: string) =>
  pedir("/api/auth/change-password", {
    method: "POST",
    cookie,
    json: { currentPassword, newPassword, revokeOtherSessions: true },
  });

describe("debeCambiarPassword", () => {
  it("un admin creado sin contraseña temporal no tiene que cambiarla", async () => {
    await crearAdmin({ email: "a@ejemplo.cl", barrios: ["b1"] });
    expect((await yo(await iniciarSesion("a@ejemplo.cl"))).usuario.debeCambiarPassword).toBe(false);
  });

  it("una presidenta con contraseña temporal la tiene que cambiar; al cambiarla, ya no", async () => {
    const temporal = await presidentaConTemporal();
    const cookie = await iniciarSesion("nueva@ejemplo.cl", temporal);
    expect((await yo(cookie)).usuario.debeCambiarPassword).toBe(true);

    const res = await cambiar(cookie, temporal, "mi-clave-nueva-1");
    expect(res.status).toBe(200);
    // Con revokeOtherSessions Better Auth abre una sesión nueva para este navegador.
    const nueva = res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    expect(nueva).toContain("session_token=");
    expect((await yo(nueva)).usuario.debeCambiarPassword).toBe(false);

    // Entra con la nueva y no con la temporal.
    await expect(iniciarSesion("nueva@ejemplo.cl", temporal)).rejects.toThrow();
    expect((await yo(await iniciarSesion("nueva@ejemplo.cl", "mi-clave-nueva-1"))).usuario.debeCambiarPassword).toBe(false);
  });

  it("si la presidenta ya tenía cuenta, asignarle un barrio no le pide cambiarla", async () => {
    await crearAdmin({ email: "a@ejemplo.cl" });
    await presidentaConTemporal("a@ejemplo.cl");
    expect((await yo(await iniciarSesion("a@ejemplo.cl"))).usuario.debeCambiarPassword).toBe(false);
  });

  it("no se puede apagar con update-user de Better Auth", async () => {
    const temporal = await presidentaConTemporal();
    const cookie = await iniciarSesion("nueva@ejemplo.cl", temporal);
    await pedir("/api/auth/update-user", { method: "POST", cookie, json: { debeCambiarPassword: false } });
    expect((await yo(cookie)).usuario.debeCambiarPassword).toBe(true);
  });
});

describe("POST /api/auth/change-password", () => {
  it("con la contraseña actual equivocada no cambia", async () => {
    const temporal = await presidentaConTemporal();
    const cookie = await iniciarSesion("nueva@ejemplo.cl", temporal);
    const res = await cambiar(cookie, "no-es-la-actual", "mi-clave-nueva-1");
    expect(res.status).toBe(400);
    expect((await res.json<any>()).code).toBe("INVALID_PASSWORD");

    expect((await yo(cookie)).usuario.debeCambiarPassword).toBe(true);
    expect(await iniciarSesion("nueva@ejemplo.cl", temporal)).toContain("session_token=");
    await expect(iniciarSesion("nueva@ejemplo.cl", "mi-clave-nueva-1")).rejects.toThrow();
  });

  it("una contraseña de menos de 10 caracteres se rechaza", async () => {
    await crearAdmin({ email: "a@ejemplo.cl" });
    const cookie = await iniciarSesion("a@ejemplo.cl");
    const res = await cambiar(cookie, PASSWORD_PRUEBA, "corta-123");
    expect(res.status).toBe(400);
    expect((await res.json<any>()).code).toBe("PASSWORD_TOO_SHORT");
    expect(await iniciarSesion("a@ejemplo.cl")).toContain("session_token=");
  });

  it("cierra las otras sesiones", async () => {
    await crearAdmin({ email: "a@ejemplo.cl" });
    const telefono = await iniciarSesion("a@ejemplo.cl");
    const computador = await iniciarSesion("a@ejemplo.cl");
    expect((await cambiar(computador, PASSWORD_PRUEBA, "mi-clave-nueva-1")).status).toBe(200);
    expect((await pedir("/api/admin/yo", { cookie: telefono })).status).toBe(401);
  });
});
